using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace TechEduAPI.Controllers
{
    [ApiController]
    [Route("api/turmas")]
    public class TurmasController : ControllerBase
    {
        private readonly IConfiguration _configuration;

        public TurmasController(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        private string GetConnectionString()
        {
            return _configuration.GetConnectionString("TechEdu")!;
        }

        // Lista as turmas
        [HttpGet]
        public async Task<IActionResult> GetTurmas()
        {
            var turmas = new List<object>();

            using SqlConnection connection = new SqlConnection(GetConnectionString());
            await connection.OpenAsync();

            string sql = @"
                SELECT
                    T.IdTurma,
                    T.Nome,
                    T.Turno,
                    T.Ativo,
                    S.IdSerie,
                    S.Nome
                FROM Turma T
                INNER JOIN Serie S ON S.IdSerie = T.IdSerie
                ORDER BY S.Nome, T.Nome";

            using SqlCommand command = new SqlCommand(sql, connection);
            using SqlDataReader reader = await command.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                turmas.Add(new
                {
                    idTurma = reader.GetInt32(0),
                    nome = reader.GetString(1),
                    turno = reader.GetString(2),
                    ativo = reader.GetBoolean(3),
                    idSerie = reader.GetInt32(4),
                    serie = reader.GetString(5)
                });
            }

            return Ok(turmas);
        }

        // Cadastra turma
        [HttpPost]
        public async Task<IActionResult> CriarTurma([FromBody] TurmaRequest turma)
        {
            if (string.IsNullOrWhiteSpace(turma.Nome))
                return BadRequest(new { mensagem = "O nome da turma é obrigatório." });

            if (turma.IdSerie <= 0)
                return BadRequest(new { mensagem = "Selecione uma série." });

            if (string.IsNullOrWhiteSpace(turma.Turno))
                return BadRequest(new { mensagem = "O turno é obrigatório." });

            using SqlConnection connection = new SqlConnection(GetConnectionString());
            await connection.OpenAsync();

            // Verifica a série
            string serieSql = @"
                SELECT COUNT(*)
                FROM Serie
                WHERE IdSerie = @IdSerie";

            using SqlCommand serieCommand = new SqlCommand(serieSql, connection);
            serieCommand.Parameters.AddWithValue("@IdSerie", turma.IdSerie);

            int serieExiste = Convert.ToInt32(await serieCommand.ExecuteScalarAsync());

            if (serieExiste == 0)
                return BadRequest(new { mensagem = "Série não encontrada." });

            // Verifica duplicidade
            string verificarSql = @"
                SELECT COUNT(*)
                FROM Turma
                WHERE IdSerie = @IdSerie
                  AND Nome = @Nome";

            using SqlCommand verificar = new SqlCommand(verificarSql, connection);
            verificar.Parameters.AddWithValue("@IdSerie", turma.IdSerie);
            verificar.Parameters.AddWithValue("@Nome", turma.Nome.Trim());

            int existe = Convert.ToInt32(await verificar.ExecuteScalarAsync());

            if (existe > 0)
                return BadRequest(new { mensagem = "Essa turma já existe nessa série." });

            // Cadastra a turma
            string sql = @"
                INSERT INTO Turma (Nome, IdSerie, Turno, Ativo)
                OUTPUT INSERTED.IdTurma
                VALUES (@Nome, @IdSerie, @Turno, 1)";

            using SqlCommand command = new SqlCommand(sql, connection);

            command.Parameters.AddWithValue("@Nome", turma.Nome.Trim());
            command.Parameters.AddWithValue("@IdSerie", turma.IdSerie);
            command.Parameters.AddWithValue("@Turno", turma.Turno.Trim());

            int novoId = Convert.ToInt32(await command.ExecuteScalarAsync());

            return Ok(new
            {
                idTurma = novoId,
                nome = turma.Nome.Trim(),
                idSerie = turma.IdSerie,
                turno = turma.Turno.Trim(),
                ativo = true
            });
        }
    }

    public class TurmaRequest
    {
        public string Nome { get; set; } = "";
        public int IdSerie { get; set; }
        public string Turno { get; set; } = "";
    }
}