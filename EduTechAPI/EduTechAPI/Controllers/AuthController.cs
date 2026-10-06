using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using System.Security.Cryptography;

namespace EduTechAPI.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly IConfiguration _configuration;
        private const string DominioInstitucional = "@aluno.unifenas.br";

        public AuthController(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        private string GetConnectionString()
        {
            return _configuration.GetConnectionString("TechEdu")!;
        }

        // Gera o hash da senha
        private static string CriarHashSenha(string senha)
        {
            byte[] salt = RandomNumberGenerator.GetBytes(16);

            byte[] hash = Rfc2898DeriveBytes.Pbkdf2(
                senha, salt, 100000, HashAlgorithmName.SHA256, 32
            );

            return Convert.ToBase64String(salt) + ":" + Convert.ToBase64String(hash);
        }

        // Verifica a senha
        private static bool VerificarSenha(string senha, string senhaSalva)
        {
            try
            {
                string[] partes = senhaSalva.Split(':');
                if (partes.Length != 2) return false;

                byte[] salt = Convert.FromBase64String(partes[0]);
                byte[] hashSalvo = Convert.FromBase64String(partes[1]);

                byte[] hashInformado = Rfc2898DeriveBytes.Pbkdf2(
                    senha, salt, 100000, HashAlgorithmName.SHA256, 32
                );

                return CryptographicOperations.FixedTimeEquals(hashSalvo, hashInformado);
            }
            catch
            {
                return false;
            }
        }

        // Valida o domínio
        private static bool EmailInstitucional(string email)
        {
            return email.EndsWith(DominioInstitucional, StringComparison.OrdinalIgnoreCase);
        }

        // Cadastra administrador
        [HttpPost("cadastrar")]
        public async Task<IActionResult> Cadastrar([FromBody] CadastroAdministradorRequest request)
        {
            string nome = request.Nome?.Trim() ?? "";
            string email = request.Email?.Trim().ToLowerInvariant() ?? "";
            string senha = request.Senha ?? "";

            if (string.IsNullOrWhiteSpace(nome))
                return BadRequest(new { mensagem = "Informe o nome." });

            if (string.IsNullOrWhiteSpace(email))
                return BadRequest(new { mensagem = "Informe o e-mail." });

            if (!EmailInstitucional(email))
                return BadRequest(new { mensagem = "Utilize um e-mail institucional @aluno.unifenas.br." });

            if (senha.Length < 6)
                return BadRequest(new { mensagem = "A senha deve possuir pelo menos 6 caracteres." });

            using SqlConnection connection = new SqlConnection(GetConnectionString());
            await connection.OpenAsync();

            // Verifica e-mail duplicado
            string verificarSql = @"
                SELECT COUNT(*)
                FROM Administrador
                WHERE LOWER(Email) = @Email";

            using SqlCommand verificarCommand = new SqlCommand(verificarSql, connection);
            verificarCommand.Parameters.AddWithValue("@Email", email);

            int quantidade = Convert.ToInt32(await verificarCommand.ExecuteScalarAsync());

            if (quantidade > 0)
                return Conflict(new { mensagem = "Este e-mail já está cadastrado." });

            string senhaHash = CriarHashSenha(senha);

            // Insere o administrador
            string inserirSql = @"
                INSERT INTO Administrador (Nome, Email, Senha)
                OUTPUT INSERTED.IdAdministrador
                VALUES (@Nome, @Email, @Senha)";

            using SqlCommand inserirCommand = new SqlCommand(inserirSql, connection);

            inserirCommand.Parameters.AddWithValue("@Nome", nome);
            inserirCommand.Parameters.AddWithValue("@Email", email);
            inserirCommand.Parameters.AddWithValue("@Senha", senhaHash);

            int idAdministrador = Convert.ToInt32(await inserirCommand.ExecuteScalarAsync());

            return Ok(new
            {
                mensagem = "Administrador cadastrado com sucesso.",
                idAdministrador,
                nome,
                email
            });
        }

        // Login
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            string email = request.Email?.Trim().ToLowerInvariant() ?? "";
            string senha = request.Senha ?? "";

            if (!EmailInstitucional(email))
                return Unauthorized(new { mensagem = "E-mail ou senha inválidos." });

            if (string.IsNullOrWhiteSpace(senha))
                return Unauthorized(new { mensagem = "E-mail ou senha inválidos." });

            using SqlConnection connection = new SqlConnection(GetConnectionString());
            await connection.OpenAsync();

            // Busca o administrador
            string sql = @"
                SELECT IdAdministrador, Nome, Email, Senha
                FROM Administrador
                WHERE LOWER(Email) = @Email";

            using SqlCommand command = new SqlCommand(sql, connection);
            command.Parameters.AddWithValue("@Email", email);

            using SqlDataReader reader = await command.ExecuteReaderAsync();

            if (!await reader.ReadAsync())
                return Unauthorized(new { mensagem = "E-mail ou senha inválidos." });

            int idAdministrador = reader.GetInt32(0);
            string nome = reader.GetString(1);
            string emailBanco = reader.GetString(2);
            string senhaSalva = reader.GetString(3);

            if (!VerificarSenha(senha, senhaSalva))
                return Unauthorized(new { mensagem = "E-mail ou senha inválidos." });

            return Ok(new
            {
                mensagem = "Login realizado com sucesso.",
                administrador = new
                {
                    idAdministrador,
                    nome,
                    email = emailBanco
                }
            });
        }
    }

    public class CadastroAdministradorRequest
    {
        public string Nome { get; set; } = "";
        public string Email { get; set; } = "";
        public string Senha { get; set; } = "";
    }

    public class LoginRequest
    {
        public string Email { get; set; } = "";
        public string Senha { get; set; } = "";
    }
}