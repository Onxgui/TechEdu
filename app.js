// FUNÇÃO AUXILIAR
const $ = id => document.getElementById(id);

// ANO DO RODAPÉ
if ($("year")) {
    $("year").textContent = new Date().getFullYear();
}

// MOSTRAR / OCULTAR SENHA
if ($("togglePassword")) {
    $("togglePassword").onclick = () => {
        $("password").type = $("password").type === "password" ? "text" : "password";
    };
}

// LOGIN
if ($("loginForm")) {
    $("loginForm").onsubmit = async e => {
        e.preventDefault();

        if (!$("loginForm").checkValidity()) {
            $("loginMessage").textContent = "Preencha os campos corretamente.";
            return;
        }

        const email = $("email").value.trim().toLowerCase();
        const senha = $("password").value;

        if (!email.endsWith("@aluno.unifenas.br")) {
            $("loginMessage").textContent = "Utilize seu e-mail institucional @aluno.unifenas.br.";
            return;
        }

        const submitButton = $("loginForm").querySelector('button[type="submit"]');

        $("loginMessage").textContent = "Entrando...";
        if (submitButton) submitButton.disabled = true;

        try {
            const response = await fetch("https://localhost:7111/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, senha })
            });

            const result = await response.json();

            if (!response.ok) {
                $("loginMessage").textContent = result.mensagem || "E-mail ou senha inválidos.";
                return;
            }

            sessionStorage.setItem("logged", "1");
            sessionStorage.setItem("adminId", String(result.administrador.idAdministrador));
            sessionStorage.setItem("adminName", result.administrador.nome);
            sessionStorage.setItem("adminEmail", result.administrador.email);

            location.href = "chamada.html";
        } catch (error) {
            console.error("Erro no login:", error);
            $("loginMessage").textContent = "Não foi possível conectar ao servidor.";
        } finally {
            if (submitButton) submitButton.disabled = false;
        }
    };
}

// ESQUECI MINHA SENHA
if ($("forgotPassword")) {
    $("forgotPassword").onclick = () => {
        alert("A recuperação de senha será implementada posteriormente.");
    };
}