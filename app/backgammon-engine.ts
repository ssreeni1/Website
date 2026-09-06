/** Pure backgammon engine. Global board coordinates match SystemCanvas.
 * WHITE travels 24 -> 1; WHITE[25] is bar, WHITE[0] is borne off.
 * BLACK travels 1 -> 24; BLACK[0] is bar, BLACK[25] is borne off.
 * The two arrays distinguish the different meanings of endpoint slots.
 * A legal, deterministic exhibition game; heuristic choices are not optimal play.
 */
export type Player = "WHITE" | "BLACK";
export type BoardState = Record<Player, number[]>;
export type Move = { from: number; to: number; die: number };
export type GameTurn = {
  player: Player;
  dice: readonly [number, number];
  moves: Move[];
  notation: string;
  before: BoardState;
  after: BoardState;
  opening: boolean;
};
export type Game = {
  seed: number;
  turns: GameTurn[];
  winner: Player;
  final: BoardState;
  result: "SINGLE" | "GAMMON" | "BACKGAMMON";
};
export const opponent = (player: Player): Player => player === "WHITE" ? "BLACK" : "WHITE";
export const barPoint = (player: Player) => player === "WHITE" ? 25 : 0;
export const offPoint = (player: Player) => player === "WHITE" ? 0 : 25;
export const distance = (player: Player, point: number) => player === "WHITE" ? point : 25 - point;
export const cloneState = (state: BoardState): BoardState => ({ WHITE: [...state.WHITE], BLACK: [...state.BLACK] });
export function initialState(): BoardState {
  const state = { WHITE: Array<number>(26).fill(0), BLACK: Array<number>(26).fill(0) };
  for (const [point, count] of [[24, 2], [13, 5], [8, 3], [6, 5]]) {
    state.WHITE[point] = count;
    state.BLACK[25 - point] = count;
  }
  return state;
}
export function pipCount(state: BoardState, player: Player): number {
  return state[player].reduce((sum, count, point) => sum + count * distance(player, point), 0);
}
export function validateState(state: BoardState): void {
  for (const player of ["WHITE", "BLACK"] as const) {
    if (state[player].length !== 26 || state[player].some(value => !Number.isInteger(value) || value < 0)) throw new Error(`Invalid ${player} counts`);
    if (state[player].reduce((sum, value) => sum + value, 0) !== 15) throw new Error(`${player} must have exactly 15 checkers`);
  }
  for (let point = 1; point <= 24; point++) {
    if (state.WHITE[point] && state.BLACK[point]) throw new Error(`Both players occupy point ${point}`);
  }
}
export function legalMoves(state: BoardState, player: Player, die: number): Move[] {
  if (!Number.isInteger(die) || die < 1 || die > 6) throw new Error("Invalid die");
  const own = state[player], other = state[opponent(player)];
  const bar = barPoint(player), off = offPoint(player), direction = player === "WHITE" ? -1 : 1;
  if (own[bar]) {
    const to = bar + direction * die;
    return other[to] < 2 ? [{ from: bar, to, die }] : [];
  }
  let farthest = 0;
  for (let point = 1; point <= 24; point++) if (own[point]) farthest = Math.max(farthest, distance(player, point));
  const moves: Move[] = [];
  for (let from = 1; from <= 24; from++) {
    if (!own[from]) continue;
    const remaining = distance(player, from);
    if (remaining > die) {
      const to = from + direction * die;
      if (other[to] < 2) moves.push({ from, to, die });
    } else if (farthest <= 6 && (remaining === die || remaining === farthest)) {
      moves.push({ from, to: off, die });
    }
  }
  return moves;
}
/** Caller selects a legal move; hits are represented by moving the blot to its bar. */
export function applyMove(state: BoardState, player: Player, move: Move): BoardState {
  const next = cloneState(state);
  next[player][move.from]--;
  if (move.to >= 1 && move.to <= 24 && next[opponent(player)][move.to] === 1) {
    next[opponent(player)][move.to] = 0;
    next[opponent(player)][barPoint(opponent(player))]++;
  }
  next[player][move.to]++;
  return next;
}
const stateKey = (state: BoardState) => `${state.WHITE.join(",")}/${state.BLACK.join(",")}`;
export type LegalPlay = { moves: Move[]; state: BoardState };
/** Enumerate both die orders and all four double moves. Prune only equivalent
 * board+remaining-dice states, then enforce maximal dice use / higher die. */
export function legalPlays(state: BoardState, player: Player, dice: readonly [number, number]): LegalPlay[] {
  const remaining = dice[0] === dice[1] ? [dice[0], dice[0], dice[0], dice[0]] : [...dice];
  const leaves: LegalPlay[] = [], visited = new Set<string>();
  const walk = (current: BoardState, unused: number[], moves: Move[]) => {
    const key = `${stateKey(current)}:${unused.join(",")}`;
    if (visited.has(key)) return;
    visited.add(key);
    if (!unused.length || current[player][offPoint(player)] === 15) {
      leaves.push({ moves, state: current });
      return;
    }
    let advanced = false;
    for (const die of new Set(unused)) {
      const rest = [...unused];
      rest.splice(rest.indexOf(die), 1);
      for (const move of legalMoves(current, player, die)) {
        advanced = true;
        walk(applyMove(current, player, move), rest, [...moves, move]);
      }
    }
    if (!advanced) leaves.push({ moves, state: current });
  };
  walk(state, remaining, []);
  const maxMoves = Math.max(...leaves.map(play => play.moves.length));
  let results = leaves.filter(play => play.moves.length === maxMoves);
  if (maxMoves === 1 && dice[0] !== dice[1]) {
    const high = Math.max(...results.map(play => play.moves[0]?.die ?? 0));
    results = results.filter(play => play.moves[0]?.die === high);
  }
  return results;
}
function randomGenerator(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function score(state: BoardState, player: Player): number {
  const own = state[player], enemy = opponent(player);
  let result = -pipCount(state, player) + pipCount(state, enemy) * 0.2 + own[offPoint(player)] * 9;
  result += state[enemy][barPoint(enemy)] * 12;
  let prime = 0;
  for (let point = 1; point <= 24; point++) {
    if (own[point] >= 2) {
      prime++;
      result += 1.5 + Math.min(prime, 6) * 0.6;
    } else prime = 0;
    if (own[point] === 1) {
      // Penalize exposed blots only when opposing checkers can reach them.
      for (let die = 1; die <= 6; die++) {
        const from = point + (enemy === "WHITE" ? die : -die);
        if (from >= 0 && from <= 25 && from !== offPoint(enemy) && state[enemy][from]) result -= 0.65;
      }
    }
  }
  if (own[offPoint(player)] === 15) result += 10000;
  return result;
}
function notationFor(state: BoardState, player: Player, moves: Move[]): string {
  if (!moves.length) return "NO LEGAL MOVE";
  let current = state;
  return moves.map(move => {
    const from = move.from === barPoint(player) ? "BAR" : String(move.from);
    const to = move.to === offPoint(player) ? "OFF" : String(move.to);
    const hit = move.to > 0 && move.to < 25 && current[opponent(player)][move.to] === 1;
    current = applyMove(current, player, move);
    return `${from}/${to}${hit ? "*" : ""}`;
  }).join(" · ");
}
export function generateGame(seed = 20260905): Game {
  const random = randomGenerator(seed), die = () => 1 + Math.floor(random() * 6);
  let state = initialState();
  const turns: GameTurn[] = [];
  let openingDice: [number, number] = [die(), die()];
  while (openingDice[0] === openingDice[1]) openingDice = [die(), die()];
  let player: Player = openingDice[0] > openingDice[1] ? "WHITE" : "BLACK";
  for (let index = 0; index < 1024; index++) {
    const dice: [number, number] = index === 0 ? openingDice : [die(), die()];
    const plays = legalPlays(state, player, dice);
    let selected = plays[0], bestScore = -Infinity;
    for (const play of plays) {
      // Seeded tie-breaks diversify positions without altering legal constraints.
      const candidate = score(play.state, player) + random() * 0.04;
      if (candidate > bestScore) { bestScore = candidate; selected = play; }
    }
    turns.push({ player, dice, moves: selected.moves, notation: notationFor(state, player, selected.moves), before: state, after: selected.state, opening: index === 0 });
    state = selected.state;
    validateState(state);
    if (state[player][offPoint(player)] === 15) {
      const loser = opponent(player);
      const backgammon = state[loser][barPoint(loser)] > 0 || state[loser].some((count, point) => point > 0 && point < 25 && distance(player, point) <= 6 && count > 0);
      const result = state[loser][offPoint(loser)] > 0 ? "SINGLE" : backgammon ? "BACKGAMMON" : "GAMMON";
      return { seed, turns, winner: player, final: state, result };
    }
    player = opponent(player);
  }
  throw new Error(`Game seed ${seed} exceeded turn limit; no incomplete game returned`);
}
/** Replays all moves, checks dice-use legality against enumerated outcomes,
 * conservation, hits, snapshots, alternation, opening roll, and winner. */
export function validateGame(game: Game): void {
  let state = initialState();
  for (let index = 0; index < game.turns.length; index++) {
    const turn = game.turns[index];
    if (!index && (turn.dice[0] === turn.dice[1] || turn.player !== (turn.dice[0] > turn.dice[1] ? "WHITE" : "BLACK"))) throw new Error("Invalid opening");
    if (index && turn.player === game.turns[index - 1].player) throw new Error("Player did not alternate");
    if (stateKey(turn.before) !== stateKey(state)) throw new Error(`Invalid before snapshot ${index}`);
    const outcomes = legalPlays(state, turn.player, turn.dice);
    const diceUsed = turn.moves.map(move => move.die).sort().join(",");
    for (const move of turn.moves) {
      if (!legalMoves(state, turn.player, move.die).some(candidate => candidate.from === move.from && candidate.to === move.to)) throw new Error(`Illegal move on turn ${index}`);
      state = applyMove(state, turn.player, move);
      validateState(state);
    }
    if (!outcomes.some(play => stateKey(play.state) === stateKey(state) && play.moves.map(move => move.die).sort().join(",") === diceUsed)) throw new Error(`Invalid dice usage on turn ${index}`);
    if (stateKey(turn.after) !== stateKey(state)) throw new Error(`Invalid after snapshot ${index}`);
    if (index < game.turns.length - 1 && state[turn.player][offPoint(turn.player)] === 15) throw new Error("Play continued after victory");
  }
  if (stateKey(game.final) !== stateKey(state) || state[game.winner][offPoint(game.winner)] !== 15) throw new Error("Invalid winner / final state");
}
