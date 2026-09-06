/** Illustrative racing simulation on a reconstructed road, not a surveyed circuit.
 * The reference road is a periodic C2 cubic B-spline of recorded XY positions.
 * A bounded discrete-curvature-energy solve chooses lateral control-point
 * offsets. This approximates a minimum-curvature racing line, not global minimum
 * lap time. Its independent speed profile respects modeled lateral grip, braking,
 * and acceleration; none of these modeled outputs are recorded car channels.
 */
type Point = { x: number; y: number };
type Location = Point & { t: number; z: number };
type Speed = { t: number; speed: number };
const wrap = (value: number, length: number) => ((value % length) + length) % length;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
function interval(values: number[], target: number) {
  let lo = 0, hi = values.length - 1;
  while (lo + 1 < hi) { const mid = (lo + hi) >> 1; if (values[mid] <= target) lo = mid; else hi = mid; }
  return lo;
}

export function buildRacingPath(locations: Location[], speeds: Speed[], recordedDuration: number, precomputedOffsets?: readonly number[]) {
  if (locations.length < 4 || speeds.length < 2 || recordedDuration <= 0) throw new Error('A complete lap is required');
  const source = locations.filter((p, i) => !i || Math.hypot(p.x-locations[i-1].x,p.y-locations[i-1].y)>0.01);
  const distances=[0];
  source.forEach((p,i)=>{const next=source[(i+1)%source.length];distances.push(distances[i]+Math.hypot(next.x-p.x,next.y-p.y));});
  const sourceLength=distances.at(-1)!;
  if (sourceLength<=0 || source.length<4) throw new Error('A non-degenerate lap is required');
  const count=Math.max(32,Math.ceil(sourceLength/60));
  const uniform=Array.from({length:count},(_,i)=>{
    const s=sourceLength*i/count,j=interval(distances,s),f=(s-distances[j])/(distances[j+1]-distances[j]);
    return {x:mix(source[j].x,source[(j+1)%source.length].x,f),y:mix(source[j].y,source[(j+1)%source.length].y,f)};
  });
  // Preserve the original road reconstruction exactly.
  const controls=uniform.map((_,i)=>{
    let x=0,y=0,total=0;
    for(let k=-5;k<=5;k++){const w=Math.exp(-k*k/8),p=uniform[wrap(i+k,count)];x+=p.x*w;y+=p.y*w;total+=w;}
    return {x:x/total,y:y/total};
  });
  const normals=controls.map((_,i)=>{
    const before=controls[wrap(i-1,count)],after=controls[(i+1)%count];
    const dx=after.x-before.x,dy=after.y-before.y,l=Math.hypot(dx,dy);
    return {x:-dy/l,y:dx/l};
  });
  // Minimize sum |unitTangent[i] - unitTangent[i-1]|^2 / meanEdgeLength
  // plus weak offset-slope regularization. This approximates integral k^2 ds,
  // rather than unnormalized point acceleration (which can pinch tight turns).
  // Projected accelerated gradient with backtracking finds a local solution;
  // it is not a global minimum-time optimizer. Calculations use metres.
  // The 6m control bound guarantees <=6m displacement
  // everywhere: cubic B-spline basis functions are positive and sum to one.
  const maxOffset=6, slopePenalty=0.001, anchorPenalty=0.000002;
  if(precomputedOffsets && (precomputedOffsets.length!==count || precomputedOffsets.some(value=>!Number.isFinite(value)||Math.abs(value)>maxOffset))) throw new Error('Invalid prepared racing line');
  let offsets=precomputedOffsets?Float64Array.from(precomputedOffsets):new Float64Array(count), momentum=1;
  const extrapolated=new Float64Array(count);
  const qx=new Float64Array(count),qy=new Float64Array(count),tx=new Float64Array(count),ty=new Float64Array(count),edgeLength=new Float64Array(count);
  const gx=new Float64Array(count),gy=new Float64Array(count),gradient=new Float64Array(count);
  function objective(d:Float64Array,withGradient:boolean){
    for(let i=0;i<count;i++){qx[i]=controls[i].x*.1+normals[i].x*d[i];qy[i]=controls[i].y*.1+normals[i].y*d[i];gx[i]=0;gy[i]=0;}
    for(let i=0;i<count;i++){const b=(i+1)%count,dx=qx[b]-qx[i],dy=qy[b]-qy[i];edgeLength[i]=Math.max(.1,Math.hypot(dx,dy));tx[i]=dx/edgeLength[i];ty[i]=dy/edgeLength[i];}
    let cost=0;
    for(let i=0;i<count;i++){
      const a=wrap(i-1,count),dx=tx[i]-tx[a],dy=ty[i]-ty[a],r2=dx*dx+dy*dy,w=2/(edgeLength[i]+edgeLength[a]);
      cost+=216*w*r2+.5*slopePenalty*(d[i]-d[a])**2+.5*anchorPenalty*d[i]**2;
      if(withGradient){
        const dotI=tx[i]*dx+ty[i]*dy,dotA=tx[a]*dx+ty[a]*dy;
        gx[i]+=216*(2*w*(dx-tx[i]*dotI)/edgeLength[i]-.5*w*w*r2*tx[i]);
        gy[i]+=216*(2*w*(dy-ty[i]*dotI)/edgeLength[i]-.5*w*w*r2*ty[i]);
        gx[a]+=216*(-2*w*(dx-tx[a]*dotA)/edgeLength[a]-.5*w*w*r2*tx[a]);
        gy[a]+=216*(-2*w*(dy-ty[a]*dotA)/edgeLength[a]-.5*w*w*r2*ty[a]);
      }
    }
    if(withGradient)for(let i=0;i<count;i++){const a=wrap(i-1,count),b=(i+1)%count;gradient[i]=(gx[a]-gx[i])*normals[i].x+(gy[a]-gy[i])*normals[i].y+slopePenalty*(2*d[i]-d[a]-d[b])+anchorPenalty*d[i];}
    return cost;
  }
  let step=.04;
  for(let iteration=0;!precomputedOffsets && iteration<3200;iteration++){
    const baseCost=objective(extrapolated,true),next=new Float64Array(count),nextMomentum=(1+Math.sqrt(1+4*momentum*momentum))/2;
    for(let search=0;search<20;search++){
      let bound=baseCost;
      for(let i=0;i<count;i++){next[i]=clamp(extrapolated[i]-step*gradient[i],-maxOffset,maxOffset);const delta=next[i]-extrapolated[i];bound+=gradient[i]*delta+delta*delta/(2*step);}
      if(objective(next,false)<=bound+1e-9)break;
      step*=.5;
    }
    const ratio=(momentum-1)/nextMomentum;
    for(let i=0;i<count;i++)extrapolated[i]=next[i]+ratio*(next[i]-offsets[i]);
    offsets=next;momentum=nextMomentum;step=Math.min(.3,step*1.03);
  }
  const lineControls=controls.map((p,i)=>({x:p.x+normals[i].x*offsets[i]*10,y:p.y+normals[i].y*offsets[i]*10}));
  function evaluate(parameter:number, points:Point[]=lineControls){
    const u=wrap(parameter,count),i=Math.floor(u),t=u-i,t2=t*t,t3=t2*t;
    const basis=[(1-3*t+3*t2-t3)/6,(4-6*t2+3*t3)/6,(1+3*t+3*t2-3*t3)/6,t3/6];
    const first=[(-3+6*t-3*t2)/6,(-12*t+9*t2)/6,(3+6*t-9*t2)/6,t2/2];
    const second=[1-t,-2+3*t,1-3*t,t];
    let x=0,y=0,dx=0,dy=0,ddx=0,ddy=0;
    for(let k=0;k<4;k++){const p=points[wrap(i+k-1,count)];x+=p.x*basis[k];y+=p.y*basis[k];dx+=p.x*first[k];dy+=p.y*first[k];ddx+=p.x*second[k];ddy+=p.y*second[k];}
    return {x,y,dx,dy,ddx,ddy,parameter:u,curvature:10*(dx*ddy-dy*ddx)/Math.max(1e-9,Math.pow(dx*dx+dy*dy,1.5))};
  }
  const resolution=count*16;
  function makeArc(points:Point[]){const arc=[0];let previous=evaluate(0,points);for(let i=1;i<=resolution;i++){const p=evaluate(i/resolution*count,points);arc.push(arc[i-1]+Math.hypot(p.x-previous.x,p.y-previous.y)*0.1);previous=p;}return arc;}
  const roadArc=makeArc(controls),lineArc=makeArc(lineControls),roadLength=roadArc.at(-1)!,length=lineArc.at(-1)!;
  function parameterAt(distance:number,arc:number[]){const d=wrap(distance,arc.at(-1)!),i=interval(arc,d),f=(d-arc[i])/(arc[i+1]-arc[i]);return (i+f)/resolution*count;}
  function distanceForParameter(parameter:number,arc:number[]){const u=wrap(parameter,count)/count*resolution,i=Math.floor(u);return mix(arc[i],arc[i+1],u-i);}
  let phaseParameter=0,best=Infinity;
  for(let i=0;i<resolution;i++){const p=evaluate(i/resolution*count,controls),d=Math.hypot(p.x-source[0].x,p.y-source[0].y);if(d<best){best=d;phaseParameter=i/resolution*count;}}
  const roadPhase=distanceForParameter(phaseParameter,roadArc),linePhase=distanceForParameter(phaseParameter,lineArc);
  const roadCount=Math.ceil(roadLength/0.65);
  const roadSamples=Array.from({length:roadCount},(_,i)=>{
    const p=evaluate(parameterAt(roadPhase+i/roadCount*roadLength,roadArc),controls);
    return {x:p.x,y:p.y,z:0,t:i/roadCount*recordedDuration};
  });
  function atDistance(distance:number){
    const d=wrap(distance,length),p=evaluate(parameterAt(d,lineArc)),road=evaluate(p.parameter,controls);
    const roadDistance=wrap(distanceForParameter(p.parameter,roadArc)-roadPhase,roadLength);
    return {...p,distance:d,roadDistance,index:Math.floor(roadDistance/roadLength*roadCount),offset:Math.hypot(p.x-road.x,p.y-road.y)*0.1,
      signedOffset:((p.x-road.x)*-road.dy+(p.y-road.y)*road.dx)/Math.hypot(road.dx,road.dy)*.1};
  }
  // A simple downforce-sensitive grip envelope, plus cyclic forward/backward
  // squared-speed propagation. These are illustrative parameters, not a W14 fit.
  const topSpeed=89,mechanicalGrip=19.5,downforceGrip=0.0032,braking=30;
  const acceleration=(v:number)=>Math.max(2.2,11.5-0.1*v);
  const profileCount=Math.ceil(length/1.5),ds=length/profileCount;
  const velocity=Array.from({length:profileCount},(_,i)=>{
    const k=Math.abs(atDistance(linePhase+i*ds).curvature);
    return Math.min(topSpeed,0.99*Math.sqrt(mechanicalGrip/Math.max(0.00001,k-downforceGrip)));
  });
  for(let pass=0;pass<12;pass++){
    for(let i=0;i<profileCount;i++){const next=(i+1)%profileCount;velocity[next]=Math.min(velocity[next],Math.sqrt(velocity[i]**2+2*acceleration(velocity[i])*ds));}
    for(let i=profileCount-1;i>=0;i--){const next=(i+1)%profileCount;velocity[i]=Math.min(velocity[i],Math.sqrt(velocity[next]**2+2*braking*ds));}
  }
  const time=[0];
  for(let i=0;i<profileCount;i++)time.push(time[i]+2*ds/(velocity[i]+velocity[(i+1)%profileCount])*1000);
  const duration=time.at(-1)!;
  function motionAt(t:number){
    const seconds=wrap(t,duration),i=interval(time,seconds),dt=(seconds-time[i])/1000;
    const v0=velocity[i],v1=velocity[(i+1)%profileCount],span=(time[i+1]-time[i])/1000,a=(v1-v0)/span;
    return {distance:i*ds+v0*dt+0.5*a*dt*dt,speed:v0+a*dt,acceleration:a};
  }
  function distanceAt(t:number){return motionAt(t).distance;}
  const speedTimes=speeds.map(p=>p.t);
  function recordedSpeedAt(t:number){
    if(t<=speedTimes[0])return speeds[0].speed;
    if(t>=speedTimes.at(-1)!)return speeds.at(-1)!.speed;
    const i=interval(speedTimes,t);return mix(speeds[i].speed,speeds[i+1].speed,(t-speedTimes[i])/(speedTimes[i+1]-speedTimes[i]));
  }
  // Keep the old integral available as a recording diagnostic, never as motion.
  const ticks=Math.ceil(recordedDuration/8),recordedStep=recordedDuration/ticks;
  let integratedLength=0;
  for(let i=1;i<=ticks;i++)integratedLength+=(recordedSpeedAt((i-1)*recordedStep)+recordedSpeedAt(i*recordedStep))/7.2*recordedStep/1000;
  function atTime(t:number){
    const motion=motionAt(t),p=atDistance(linePhase+motion.distance),drag=0.0012*motion.speed*motion.speed;
    const recordedTime=wrap(t,duration)/duration*recordedDuration;
    return {...p,modeledSpeed:motion.speed*3.6,modeledAcceleration:motion.acceleration,
      modeledThrottle:motion.acceleration<-.15?0:100*clamp((motion.acceleration+drag)/(acceleration(motion.speed)+drag),0,1),
      modeledBrake:100*clamp(-motion.acceleration/braking,0,1),recordedTime,recordedSpeed:recordedSpeedAt(recordedTime)};
  }
  return {atTime,atDistance,distanceAt,roadSamples,length,roadLength,integratedLength,duration,recordedDuration,controlOffsets:Array.from(offsets),
    model:{maxOffset,mechanicalGrip,downforceGrip,braking,topSpeed,method:'bounded discrete-curvature-energy approximation'}};
}
