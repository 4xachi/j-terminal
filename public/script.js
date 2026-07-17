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
    <b>John Mark Talento Estrada</b> — Backend Developer based in Tagaytay City, Philippines.<br><br>
    I build web and mobile apps with a focus on fixing bugs and improving user experience.
    My tech stack includes PHP, Python, JavaScript/TypeScript, Java, Dart, React, Flutter, MySQL, and PostgreSQL.<br><br>
    <b>Available for freelance projects</b> — type <b>hire</b> to work with me.<br><br>
    Type <b>help</b> to explore. Try: <b>projects</b>, <b>skills</b>, <b>experience</b>, <b>education</b>, <b>hire</b>.
    </div>
    `;

    const helpMessage = `
    <b>💻 System Commands:</b><br>
    <b>help or h</b>       - Show available commands<br>
    <b>clear or cls</b>    - Clear the terminal<br>
    <b>neofetch or fetch</b> - Display system info (Windows/Linux specs)<br>
    <br>
    <b>👤 Personal Information:</b><br>
    <b>whoami</b>     - Display my identity<br>
    <b>skills</b>     - Show my technical skills<br>
    <b>projects</b>   - List my featured projects<br>
    <b>experience</b> - Show my work experience<br>
    <b>education</b>  - Display my academic history<br>
    <b>hire</b>       - Freelance services & availability<br>
    <b>faq</b>        - Frequently asked questions<br>
    <br>
    <b>🌐 Online Profiles:</b><br>
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
        <span class="blue">      /\\      </span>  User: johnstr
        <span class="blue">     /  \\     </span>  OS: Windows / Linux
        <span class="blue">    /    \\    </span>  Hostname: johnstr.onrender.com
        <span class="blue">   /  /\\  \\   </span>  Time: ${currentTime}
        <span class="blue">  /  (--)  \\  </span>  Email: <a href="mailto:jhnmrkmain@gmail.com" class="custom-link">jhnmrkmain@gmail.com</a>
        <span class="blue"> /  /    \\  \\ </span>  GitHub: <a href="https://github.com/4xachi" target="_blank" class="custom-link">github.com/4xachi</a>
        <span class="blue">/___\\    /___\\</span>  Location: Tagaytay City, PH
        </pre>`;
        },

        github: () => {
            window.open("https://github.com/4xachi", "_blank");
            return `Opening <a href="https://github.com/4xachi" target="_blank" class="custom-link">GitHub/4xachi</a>...`;
        },

        linkedin: () => {
            window.open("https://linkedin.com/in/kartikjain1410", "_blank");
            return `Opening <a href="https://linkedin.com/in/kartikjain1410" target="_blank" class="custom-link">LinkedIn/kartikjain1410</a>...`;
        },

        whoami: `<a href="https://johnstr.onrender.com" class="custom-link">John Mark Talento Estrada</a> — Backend Developer based in Tagaytay City, Philippines, passionate about building web and mobile apps, fixing bugs, and improving user experience.`,

        contact: `
        <b>Get in touch:</b><br>
        • Email: <a href="mailto:jhnmrkmain@gmail.com" class="custom-link">jhnmrkmain@gmail.com</a><br>
        • Phone: 0926-071-1868<br>
        • GitHub: <a href="https://github.com/4xachi" target="_blank" rel="noopener" class="custom-link">github.com/4xachi</a><br>
        `,

        hire: `
        <b>💼 Available for Freelance Projects</b><br><br>
        I take on <b>backend development</b> and <b>web/mobile</b> engineering work:<br>
        • Full-stack web development (HTML, CSS, JavaScript, PHP, React)<br>
        • Mobile application development (React Native, Flutter, Dart)<br>
        • API development &amp; integration (Python, PHP, SQL)<br>
        • Database setup &amp; optimization (MySQL, PostgreSQL, MongoDB, Supabase)<br><br>
        Let's talk → <a href="mailto:jhnmrkmain@gmail.com?subject=Freelance%20Project%20Inquiry" class="custom-link">jhnmrkmain@gmail.com</a>
        `,

        faq: `
        <b>❓ Frequently Asked Questions</b><br><br>
        <b>Who is John Mark Talento Estrada?</b><br>
        Backend developer from Tagaytay City, Philippines, with experience maintaining e-commerce systems.<br><br>
        <b>Available for freelance work?</b><br>
        Yes — web development, mobile app creation, API design, and backend integrations. Type <b>hire</b>.<br><br>
        <b>What does he specialize in?</b><br>
        PHP, Python, JavaScript/TypeScript, and database technologies (MySQL, PostgreSQL, Supabase).<br><br>
        <b>How to contact / hire?</b><br>
        Email <a href="mailto:jhnmrkmain@gmail.com" class="custom-link">jhnmrkmain@gmail.com</a>. Also on GitHub.
        `,

        projects: `
        <b>Featured Projects:</b><br>
        • <b>EVYM HUMANIZER</b> — Developed a system to rewrite AI-generated content into natural human patterns, resulting in a 25% increase in user engagement. GitHub: <a href="https://github.com/4xachi/evym-humanizer" target="_blank" class="custom-link">evym-humanizer</a><br>
        • <b>EYYSATCITY</b> — Created an interactive student simulation environment that tracks user progress, allowing for better identification of resource gaps. GitHub: <a href="https://github.com/4xachi/EYYSATCITY" target="_blank" class="custom-link">EYYSATCITY</a><br>
        • <b>PRIVACY RESUME</b> — Built an AI-powered resume builder tool that reduced user document creation time by 40% through automated content suggestions. Website: <a href="https://privacy-cv.onrender.com" target="_blank" class="custom-link">privacy-cv.onrender.com</a><br>
        `,

        skills: `
        <b>Technical Skills:</b><br>
        • Languages: PHP, Python, Java, JavaScript, TypeScript, Dart<br>
        • Frameworks: React, React Native, Flutter<br>
        • Databases &amp; Cloud: MySQL, PostgreSQL, MongoDB, Firebase, Supabase<br>
        • Developer Tools: Git, GitHub, Vercel, Render<br>
        • Operating Systems: Windows, Linux<br>
        • AI Tools: Cursor, Claude, Antigravity, Codex<br>
        `,

        experience: `
        <b>Work Experience:</b><br>
        • <b>Web Developer Intern</b> — PCLE COMPUTER WORX (2022-09 - 2023-02)<br>
          &nbsp;&nbsp;Tagaytay City<br>
          &nbsp;&nbsp;- Updated JavaScript, PHP, and SQL code for the company's e-commerce platform, which resolved database connection issues.<br>
          &nbsp;&nbsp;- Redesigned checkout interface using HTML, CSS, and JS, fixing mobile bugs and simplifying the purchasing process.<br>
          &nbsp;&nbsp;- Tested payment gateway functionality alongside senior team members, identifying and patching security vulnerabilities.<br>
        `,

        education: `
        <b>Education:</b><br>
        • <b>Bachelor of Science in Computer Science</b> — AISAT DASMA (October 2023 - Present)<br>
        • <b>Information and Communication Technology</b> — Olivarez College Tagaytay (April 2023)<br>
        `,

        resume: () => {
            const link = document.createElement("a");
            link.href = "/Resume.pdf";
            link.download = "John_Mark_Talento_Estrada_Resume.pdf";
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
        r: "resume",
        c: "contact",
        email: "contact",
        cls: "clear",
        h: "help",
        fetch: "neofetch",
        exp: "experience",
        edu: "education"
    };

    const commandList = Object.keys(commands).concat(Object.keys(aliases));

    const PRIVATE_ACCESS_COMMAND = "ssh private";
    let terminalMode = "command"; // "command", "login_username", "login_password", "claim_token", "claim_username", "claim_display", "claim_password"
    let loginData = { username: "", password: "", token: "", displayName: "" };

    function processCommand(cmd) {
        const trimmed = cmd.trim();
        if (!trimmed) return;

        // If in login/onboarding flow, handle differently
        if (terminalMode !== "command") {
            handleInteractiveFlow(trimmed);
            return;
        }

        commandHistory.push(trimmed);
        historyIndex = commandHistory.length;

        let cmdKey = trimmed.toLowerCase();
        if (aliases[cmdKey]) cmdKey = aliases[cmdKey];

        if (cmdKey === PRIVATE_ACCESS_COMMAND) {
            startLoginFlow();
            return;
        }

        if (cmdKey === "clear" || cmdKey === "exit") return resetTerminal();

        let response =
            typeof commands[cmdKey] === "function"
                ? commands[cmdKey]()
                : commands[cmdKey] || getClosestCommand(cmdKey);

        appendCommand(trimmed, response);
    }

    function startLoginFlow() {
        terminalMode = "login_username";
        appendCommand("ssh private", "Establishing secure remote connection...<br>Node: johnstr.onrender.com<br>Status: ONLINE<br><br>Enter invitation code or username:");
    }

    async function handleInteractiveFlow(inputVal) {
        if (terminalMode === "login_username") {
            const raw = inputVal;
            if (raw.startsWith("inv_")) {
                loginData.token = raw;
                try {
                    const res = await fetch(`/api/invitations/verify/${raw}`);
                    const data = await res.json();
                    if (res.ok && data.valid) {
                        terminalMode = "claim_username";
                        appendCommand(raw, "Token verified. Let's create your account.<br><br>Enter new username (alphanumeric, 3-20 chars):");
                    } else {
                        appendCommand(raw, `<span style="color: #ff5555">Error: ${data.error || "Invalid or expired token"}</span><br><br>Enter invitation code or username:`);
                    }
                } catch (err) {
                    appendCommand(raw, `<span style="color: #ff5555">Network error. Please try again:</span>`);
                }
            } else {
                const username = raw.toLowerCase().trim();
                try {
                    const res = await fetch(`/api/users/check/${username}`);
                    const data = await res.json();
                    if (res.ok && data.exists) {
                        loginData.username = username;
                        terminalMode = "login_password";
                        appendCommand(raw, "Enter password (input will be hidden):");
                        input.type = "password";
                    } else {
                        appendCommand(raw, `<span style="color: #ff5555">Error: Username does not exist.</span><br><br>Enter invitation code or username:`);
                    }
                } catch (err) {
                    appendCommand(raw, `<span style="color: #ff5555">Network error. Please try again:</span>`);
                }
            }
        } else if (terminalMode === "login_password") {
            loginData.password = inputVal;
            input.type = "text";
            appendCommand("********", "Authenticating...");

            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: loginData.username, password: loginData.password })
                });
                const data = await res.json();
                if (res.ok) {
                    appendCommand("system", "Authentication successful. Redirecting to private node...");
                    setTimeout(() => {
                        window.location.href = "/private";
                    }, 1000);
                } else {
                    terminalMode = "command";
                    appendCommand("system", `<span style="color: #ff5555">Authentication failed: ${data.error || "Invalid username or password"}</span>`);
                }
            } catch (err) {
                terminalMode = "command";
                appendCommand("system", `<span style="color: #ff5555">Network error during authentication.</span>`);
            }
        } else if (terminalMode === "claim_username") {
            loginData.username = inputVal.toLowerCase();
            if (loginData.username.length < 3 || loginData.username.length > 20 || !/^[a-zA-Z0-9_]+$/.test(loginData.username)) {
                appendCommand(inputVal, `<span style="color: #ff5555">Username must be alphanumeric, 3-20 characters.</span><br><br>Enter new username:`);
                return;
            }
            terminalMode = "claim_display";
            appendCommand(inputVal, "Enter display name:");
        } else if (terminalMode === "claim_display") {
            loginData.displayName = inputVal;
            if (!loginData.displayName) {
                appendCommand(inputVal, `<span style="color: #ff5555">Display name cannot be empty.</span><br><br>Enter display name:`);
                return;
            }
            terminalMode = "claim_password";
            appendCommand(inputVal, "Enter password (input will be hidden):");
            input.type = "password";
        } else if (terminalMode === "claim_password") {
            loginData.password = inputVal;
            input.type = "text";
            appendCommand("********", "Creating account and establishing session...");

            try {
                const res = await fetch('/api/invitations/claim', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token: loginData.token,
                        username: loginData.username,
                        displayName: loginData.displayName,
                        password: loginData.password
                    })
                });
                const data = await res.json();
                if (res.ok) {
                    appendCommand("system", "Account created successfully. Redirecting to private node...");
                    setTimeout(() => {
                        window.location.href = "/private";
                    }, 1000);
                } else {
                    terminalMode = "command";
                    appendCommand("system", `<span style="color: #ff5555">Onboarding failed: ${data.error || "Error"}</span>`);
                }
            } catch (err) {
                terminalMode = "command";
                appendCommand("system", `<span style="color: #ff5555">Network error during onboarding.</span>`);
            }
        }
    }

    function checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('auth') === 'required') {
            window.history.replaceState({}, document.title, window.location.pathname);
            appendCommand("system", "Session expired or authentication required.");
            startLoginFlow();
        }
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
        checkUrlParams();
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
        if (!currentInput || input.type === "password" || terminalMode !== "command") {
            hint.textContent = "";
            mirror.textContent = "";
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
