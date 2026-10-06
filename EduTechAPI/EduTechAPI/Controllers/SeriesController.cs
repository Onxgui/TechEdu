using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace TechEduAPI.Controllers
{
    [ApiController]
    [Route("api/series")]
    public class SeriesController : ControllerBase
    {
        private readonly IConfiguration _configuration;

        public SeriesController(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        private string GetConnectionString()
        {
            return _configuration.GetConnectionString("TechEdu")!;
        }

        // Lista as séries
        [HttpGet]
        public async Task<IActionResult> GetSeries()
        {
            var series = new List<object>();

            using SqlConnection connection = new SqlConnection(GetConnectionString());
            await connection.OpenAsync();

            string sql = @"
                SELECT IdSerie, Nome, Ativo
                FROM Serie
                ORDER BY Nome";

            using SqlCommand command = new SqlCommand(sql, connection);
            using SqlDataReader reader = await command.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                series.Add(new
                {
                    idSerie = reader.GetInt32(0),
                    nome = reader.GetString(1),
                    ativo = reader.GetBoolean(2)
                });
            }

            return Ok(series);
        }

        // Cadastra série
        [HttpPost]
        public async Task<IActionResult> CriarSerie([FromBody] SerieRequest serie)
        {
            if (string.IsNullOrWhiteSpace(serie.Nome))
                return BadRequest(new { mensagem = "O nome da série é obrigatório." });

            using SqlConnection connection = new SqlConnection(GetConnectionString());
            await connection.OpenAsync();

            // Verifica duplicidade
            string verificarSql = @"
                SELECT COUNT(*)
                FROM Serie
                WHERE Nome = @Nome";

            using SqlCommand verificar = new SqlCommand(verificarSql, connection);
            verificar.Parameters.AddWithValue("@Nome", serie.Nome.Trim());

            int existe = Convert.ToInt32(await verificar.ExecuteScalarAsync());

            if (existe > 0)
                return BadRequest(new { mensagem = "Essa série já está cadastrada." });

            // Cadastra a série
            string sql = @"
                INSERT INTO Serie (Nome, Ativo)
                OUTPUT INSERTED.IdSerie
                VALUES (@Nome, 1)";

            using SqlCommand command = new SqlCommand(sql, connection);
            command.Parameters.AddWithValue("@Nome", serie.Nome.Trim());

            int novoId = Convert.ToInt32(await command.ExecuteScalarAsync());

            return Ok(new
            {
                idSerie = novoId,
                nome = serie.Nome.Trim(),
                ativo = true
            });
        }
    }

    public class SerieRequest
    {
        public string Nome { get; set; } = "";
    }
}