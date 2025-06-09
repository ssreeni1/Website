document.addEventListener('DOMContentLoaded', function() {
    const input = document.getElementById('input');
    const output = document.getElementById('output');
    const cursor = document.querySelector('.cursor');
    
    // Focus input on page load and when clicking anywhere in the terminal
    document.querySelector('.terminal-content').addEventListener('click', function() {
        input.focus();
    });
    
    input.focus();
    
    // Handle input focus and blur events to show/hide cursor
    input.addEventListener('focus', function() {
        cursor.style.display = 'inline-block';
    });
    
    input.addEventListener('blur', function() {
        cursor.style.display = 'none';
    });
    
    // Content sections from the original website
    const sections = {
        work: `<p><a class="links" href="https://www.linkedin.com/in/snlsrn/" target="_blank">Work</a>: Building <a class="links" href="https://www.ritual.net/" target="_blank">Ritual</a> + Investing @ <a class="links" href="https://www.accomplice.co/" target="_blank">Accomplice</a>. Prev: <a class="links" href="https://www.alkimiya.io/" target="_blank">Alkimiya</a>,  <a class="links" href="https://www.dragonfly.xyz/" target="_blank">Dragonfly</a>, <a class="links" href="https://www.polychain.capital/" target="_blank">Polychain</a>, and <a class="links" href="https://met.berkeley.edu/" target="_blank"> UC Berkeley M.E.T.</a>.</p>`,
        
        content: `<p><a class="links" href="https://twitter.com/sanlsrni" target="_blank">Content </a>: <a class="links" href="https://openalchemy.substack.com/welcome" target="_blank">Open Alchemy (Substack where I do most of my writing)</a> + <a class="links" href="https://medium.com/dragonfly-research/dr-reorg-or-how-i-learned-to-stop-worrying-and-love-mev-2ee72b428d1d" target="_blank">reorg defense analysis</a> & <a class="links" href="https://www.crowdcast.io/e/reorg-wtf-summit/13" target="_blank">talk</a> + <a class="links" href="http://blockcrunch.libsyn.com/biweekly-recap-china-fud-mark-cuban-burned-and-the-first-protocol-lawsuit-june-2011" target="_blank">Blockcrunch Recap 1</a> & <a class="links" href="http://blockcrunch.libsyn.com/bi-weekly-recap-sushi-the-people-vs-vcs-ethereum-re-org-debunked-july-2021" target="_blank">2</a> + <a class="links" href="https://twitter.com/sanlsrni/status/1446225300518432770" target="_blank">fractional auction mechanism design</a>.</p>`,
        
        location: `<p>(mostly) NYC, but also SF, HK and SG.</p>`,
        
        fun: `<p>Fun: Competitive backgammon, DJing, tennis/padel, horology, F1/rally, etc.</p>`
    };
    
    // Available commands
    const commands = {
        '/help': 'List available commands',
        '/work': 'Display work information',
        '/content': 'Display content information',
        '/location': 'Display location information',
        '/fun': 'Display fun activities and interests',
        '/clear': 'Clear the terminal',
        '/about': 'About this CLI interface'
    };
    
    // Handle key events
    input.addEventListener('keydown', function(e) {
        // Handle Enter key
        if (e.key === 'Enter') {
            e.preventDefault();
            
            const command = input.textContent.trim();
            
            // Add command to output
            const commandLine = document.createElement('div');
            commandLine.innerHTML = `<span class="prompt">$</span> ${command}`;
            output.appendChild(commandLine);
            
            // Process command
            processCommand(command);
            
            // Clear input
            input.textContent = '';
        }
    });
    
    // Process commands
    function processCommand(command) {
        const commandOutput = document.createElement('div');
        commandOutput.className = 'command-output';
        
        switch(command.toLowerCase()) {
            case '/help':
                const dropdown = document.createElement('div');
                dropdown.className = 'dropdown';
                
                for (const [cmd, desc] of Object.entries(commands)) {
                    const item = document.createElement('div');
                    item.className = 'dropdown-item';
                    item.innerHTML = `<strong>${cmd}</strong> - ${desc}`;
                    dropdown.appendChild(item);
                }
                
                commandOutput.appendChild(dropdown);
                break;
                
            case '/work':
                commandOutput.innerHTML = sections.work;
                break;
                
            case '/content':
                commandOutput.innerHTML = sections.content;
                break;
                
            case '/location':
                commandOutput.innerHTML = sections.location;
                break;
                
            case '/fun':
                commandOutput.innerHTML = sections.fun;
                break;
                
            case '/clear':
                output.innerHTML = '';
                return;
                
            case '/about':
                commandOutput.innerHTML = `<p>This is a CLI-like interface for saneel.xyz. It was created to provide a unique and interactive way to navigate the website content.</p>`;
                break;
                
            default:
                if (command.trim() !== '') {
                    commandOutput.textContent = `Command not found: ${command}. Type /help for available commands.`;
                } else {
                    return;
                }
        }
        
        output.appendChild(commandOutput);
        
        // Scroll to bottom
        output.scrollTop = output.scrollHeight;
    }
});
