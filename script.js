document.addEventListener("DOMContentLoaded", function () {
    const input = document.getElementById("commandInput");
    const output = document.getElementById("output");
    const terminal = document.getElementById("terminal-container");
    const hint = document.getElementById("autocompleteHint");
    const mirror = document.getElementById("inputMirror");

    let commandHistory = [];
    let historyIndex = -1;

    // Auto-printed on load so visitors — and search/AI crawlers that render
    // JavaScript — see real, indexable content instead of an empty terminal.
    const welcomeMessage = `
    <div class="welcome">
    <span class="prompt">λ</span> whoami<br>
    <b>Kartik Jain</b> — Backend Developer &amp; Cybersecurity Researcher based in Mumbai, India.<br><br>
    I build secure, scalable backend systems (Node.js, FastAPI, PostgreSQL) and developer tools,
    and I research application security — with responsible disclosures to <b>Meta (WhatsApp)</b>,
    <b>Microsoft</b>, and others.<br><br>
    <b>Available for freelance projects</b> — type <b>hire</b> to work with me.<br><br>
    Type <b>help</b> to explore. Try: <b>projects</b>, <b>skills</b>, <b>awards</b>, <b>hire</b>.
    </div>
    `;

    const helpMessage = `
    <b>💻 System Commands:</b><br>
    <b>help or h</b>       - Show available commands<br>
    <b>clear or cls</b>    - Clear the terminal<br>
    <b>neofetch or fetch</b> - Display system info (Arch Linux style)<br>
    <br>
    <b>👤 Personal Information:</b><br>
    <b>whoami</b>     - Display my identity<br>
    <b>skills</b>     - Show my technical skills<br>
    <b>projects</b>   - List my featured projects<br>
    <b>awards</b>     - Display my security discoveries<br>
    <b>others</b>     - Show my leadership and soft skills<br>
    <b>hire</b>       - Freelance services & availability<br>
    <b>faq</b>        - Frequently asked questions<br>
    <br>
    <b>🌐 Online Profiles:</b><br>
    <b>linkedin or ln</b>  - Open my LinkedIn<br>
    <b>github or gh</b>    - Open my GitHub<br>
    <b>contact or c</b>    - Show how to reach me<br>
    <br>
    <b>📄 Documents:</b><br>
    <b>resume or r</b>     - Download my resume<br>
    `;

    const commands = {
        help: helpMessage,

        neofetch: () => {
            let currentTime = new Date().toLocaleTimeString();
            return `<pre>
        <span class="blue">      /\\      </span>  User: jkartik
        <span class="blue">     /  \\     </span>  OS: Arch Linux
        <span class="blue">    /    \\    </span>  Hostname: jkartik.in
        <span class="blue">   /  /\\  \\   </span>  Time: ${currentTime}
        <span class="blue">  /  (--)  \\  </span>  Email: <a href="mailto:contact@jkartik.in" class="custom-link">contact@jkartik.in</a>
        <span class="blue"> /  /    \\  \\ </span>  GitHub: <a href="https://github.com/KartikJain14" target="_blank" class="custom-link">github.com/KartikJain14</a>
        <span class="blue">/___\\    /___\\</span>  LinkedIn: <a href="https://linkedin.com/in/kartikjain1410" target="_blank" class="custom-link">linkedin.com/in/kartikjain1410</a>
        </pre>`;
        },

        github: () => {
            window.open("https://github.com/KartikJain14", "_blank");
            return `Opening <a href="https://github.com/KartikJain14" target="_blank" class="custom-link">GitHub/KartikJain14</a>...`;
        },

        linkedin: () => {
            window.open("https://linkedin.com/in/kartikjain1410", "_blank");
            return `Opening <a href="https://linkedin.com/in/kartikjain1410" target="_blank" class="custom-link">LinkedIn/kartikjain1410</a>...`;
        },

        whoami: `<a href="https://jkartik.in" class="custom-link">Kartik Jain</a> — Backend & Security Engineer based in Mumbai, India, passionate about secure system design, automation, and digital infrastructure.`,

        contact: `
        <b>Get in touch:</b><br>
        • Email: <a href="mailto:contact@jkartik.in" class="custom-link">contact@jkartik.in</a><br>
        • Security: <a href="mailto:security@jkartik.in" class="custom-link">security@jkartik.in</a><br>
        • GitHub: <a href="https://github.com/KartikJain14" target="_blank" rel="noopener" class="custom-link">github.com/KartikJain14</a><br>
        • LinkedIn: <a href="https://linkedin.com/in/kartikjain1410" target="_blank" rel="noopener" class="custom-link">linkedin.com/in/kartikjain1410</a><br>
        `,

        hire: `
        <b>💼 Available for Freelance Projects</b><br><br>
        I take on <b>cybersecurity</b> and <b>backend</b> engineering work:<br>
        • Security assessments &amp; penetration testing<br>
        • Vulnerability research &amp; responsible disclosure<br>
        • Secure backend &amp; API development (Node.js, FastAPI, PostgreSQL)<br>
        • DevOps, automation &amp; cloud (Docker, AWS)<br><br>
        Let's talk → <a href="mailto:contact@jkartik.in?subject=Freelance%20Project%20Inquiry" class="custom-link">contact@jkartik.in</a>
        `,

        faq: `
        <b>❓ Frequently Asked Questions</b><br><br>
        <b>Who is Kartik Jain?</b><br>
        Backend developer &amp; cybersecurity researcher from Mumbai, India, with disclosures to Meta (WhatsApp) &amp; Microsoft.<br><br>
        <b>Available for freelance work?</b><br>
        Yes — security assessments, pentesting, and secure backend/API development. Type <b>hire</b>.<br><br>
        <b>What does he specialize in?</b><br>
        Secure backends (Node.js, FastAPI, PostgreSQL) and application security.<br><br>
        <b>How to contact / hire?</b><br>
        Email <a href="mailto:contact@jkartik.in" class="custom-link">contact@jkartik.in</a>. Also on GitHub &amp; LinkedIn.
        `,

        projects: `
        <b>Featured Projects:</b><br>
        • <b>mpstme.pics</b> — Production-grade <b>photo-sharing platform backend</b> using Node.js, Express, PostgreSQL, Drizzle ORM, and AWS S3.<br>
        • <b>Event Registration Platform</b> — Full-stack event system with <b>Cashfree payments</b>, email confirmations, QR-based ticket scanning, and admin analytics.<br>
        • <b>Event App Backends</b> — FastAPI + PostgreSQL systems powering <i>Taqneeq Fest</i> & <i>Mumbai MUN</i> Flutter apps with referral systems and real-time sync.<br>
        • <b>Certificate Portal</b> — Automated event certificate generator and verifier supporting CSV batch upload & template positioning.<br>
        • <b>F1 Semicolon</b> — Real-time multiplayer quiz racing game using Node.js, WebSockets, and Redis.<br>
        `,

        skills: `
        <b>Core Skills:</b><br>
        • Languages: Python, TypeScript, Dart, C++, Java<br>
        • Backend: Node.js, FastAPI, Flask, Express.js<br>
        • Databases: PostgreSQL, Drizzle ORM, MongoDB<br>
        • Security: Burp Suite, Nmap, Semgrep, Nuclei, Sliver C2<br>
        • DevOps: Docker, Nginx, Redis, CI/CD<br>
        • Cloud: AWS, Azure, GCP, Oracle Cloud<br>
        • Tools: Git, Postman, Neo4J, Linux (Arch, Ubuntu)<br>
        `,

        awards: `
        <b>Security Research:</b><br>
        • Reported <b>Privilege Escalation</b> in <b>Meta’s WhatsApp</b>.<br>
        • Disclosed vulnerabilities in <b>Microsoft Intune</b> and <b>Exchange Admin</b>.<br>
        • Responsible disclosure of <b>Stored XSS</b> in <b>Mumbai Police</b> website (via CERT-In).<br>
        • Found critical exposures in <b>The Souled Store</b> and <b>Belgian Waffle Co.</b> allowing potential infrastructure/CRM compromise.<br>
        `,

        others: `
        <b>Leadership & Traits:</b><br>
        • Technical SuperCore at ACM MPSTME and Technical Head at Taqneeq & Mumbai MUN.<br>
        • Leads 150+ students in cybersecurity awareness and tech development.<br>
        • Strong communicator, quick learner, and proactive problem solver.<br>
        • Enjoys building secure, scalable systems and mentoring juniors.<br>
        `,

        resume: () => {
            const link = document.createElement("a");
            link.href = "/Kartik_Resume.pdf";
            link.download = "Kartik_Resume.pdf";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            return "Downloading updated resume...";
        },

        clear: () => resetTerminal(),
        exit: () => resetTerminal(),
    };

    const aliases = {
        gh: "github",
        ln: "linkedin",
        r: "resume",
        c: "contact",
        email: "contact",
        cls: "clear",
        h: "help",
        fetch: "neofetch"
    };

    const commandList = Object.keys(commands).concat(Object.keys(aliases));

    function processCommand(cmd) {
        cmd = cmd.toLowerCase();
        if (!cmd) return;

        commandHistory.push(cmd);
        historyIndex = commandHistory.length;

        if (aliases[cmd]) cmd = aliases[cmd];
        if (cmd === "clear" || cmd === "exit") return resetTerminal();

        let response =
            typeof commands[cmd] === "function"
                ? commands[cmd]()
                : commands[cmd] || getClosestCommand(cmd);

        appendCommand(cmd, response);
    }

    function resetTerminal() {
        output.innerHTML = `<div class="help-message">Type 'help' to see available commands.</div>`;
        input.value = "";
        hint.textContent = "";
    }

    function printWelcome() {
        output.innerHTML = welcomeMessage;
        input.value = "";
        hint.textContent = "";
    }

    function appendCommand(command, result) {
        const commandLine = document.createElement("div");
        commandLine.classList.add("command-line");
        commandLine.innerHTML = `<span class="prompt">λ</span> ${command}`;
        output.appendChild(commandLine);

        const resultLine = document.createElement("div");
        resultLine.classList.add("command-result");
        resultLine.innerHTML = result;
        output.appendChild(resultLine);

        input.scrollIntoView({ behavior: "smooth" });
    }

    function getClosestCommand(inputCmd) {
        const closestMatch = commandList.find(cmd => cmd.startsWith(inputCmd));
        return closestMatch
            ? `Did you mean <b>${closestMatch}</b>?`
            : `Command not found: ${inputCmd}`;
    }

    function updateAutocompleteHint() {
        const currentInput = input.value;
        if (!currentInput) {
            hint.textContent = "";
            return;
        }
        const match = commandList.find(cmd => cmd.startsWith(currentInput));
        if (match) {
            hint.textContent = match.slice(currentInput.length);
            mirror.textContent = currentInput;
            hint.style.left = mirror.offsetWidth + "px";
        } else {
            hint.textContent = "";
        }
    }

    function autocompleteCommand() {
        const currentInput = input.value;
        if (!currentInput) return;
        const match = commandList.find(cmd => cmd.startsWith(currentInput));
        if (match) input.value = match;
        hint.textContent = "";
    }

    function createCommandBar() {
        const bar = document.getElementById("command-bar");
        const allCommands = Object.keys(commands);
        [...allCommands].sort().forEach(cmd => {
            const button = document.createElement("button");
            button.textContent = cmd;
            button.dataset.cmd = cmd;
            button.addEventListener("click", () => processCommand(cmd));
            bar.appendChild(button);
        });
    }

    input.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            processCommand(input.value.trim());
            input.value = "";
            hint.textContent = "";
        } else if (event.key === "ArrowRight" || event.key === "Tab") {
            event.preventDefault();
            autocompleteCommand();
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            if (historyIndex > 0) {
                historyIndex--;
                input.value = commandHistory[historyIndex];
            }
        } else if (event.key === "ArrowDown") {
            event.preventDefault();
            if (historyIndex < commandHistory.length - 1) {
                historyIndex++;
                input.value = commandHistory[historyIndex];
            } else {
                historyIndex = commandHistory.length;
                input.value = "";
            }
        }
    });

    input.addEventListener("input", updateAutocompleteHint);
    terminal.addEventListener("click", () => input.focus());

    printWelcome();
    createCommandBar();
});
