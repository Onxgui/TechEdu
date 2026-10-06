using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace TechEduAPI.Controllers
{
    [ApiController]
    [Route("api/alunos")]
    public class AlunosController : ControllerBase
    {
        private readonly IConfiguration _configuration;

        public AlunosController(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        private string GetConnectionString()
        {
            return _configuration.GetConnectionString("TechEdu")!;
        }

        // Lista os alunos
        [HttpGet]
        public async Task<IActionResult> GetAlunos()
        {
            var alunos = new List<object>();

            using SqlConnection connection = new SqlConnection(GetConnectionString());
            await connection.OpenAsync();

            string sql = @"
                SELECT
                    A.IdAluno,
                    A.Nome,
                    A.IdTurma,
                    T.Nome AS Turma,
                    T.Turno,
                    S.IdSerie,
                    S.Nome AS Serie,
                    A.SerieEscolar,
                    A.Turno AS TurnoAntigo,
                    A.DataCadastro,
                    A.Ativo
                FROM Aluno A
                LEFT JOIN Turma T ON T.IdTurma = A.IdTurma
                LEFT JOIN Serie S ON S.IdSerie = T.IdSerie
                ORDER BY A.Nome";

            using SqlCommand command = new SqlCommand(sql, connection);
            using SqlDataReader reader = await command.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                alunos.Add(new
                {
                    idAluno = reader.GetInt32(0),
                    nome = reader.GetString(1),
                    idTurma = reader.IsDBNull(2) ? (int?)null : reader.GetInt32(2),
                    turma = reader.IsDBNull(3) ? null : reader.GetString(3),
                    turno = reader.IsDBNull(4) ? reader.GetString(8) : reader.GetString(4),
                    idSerie = reader.IsDBNull(5) ? (int?)null : reader.GetInt32(5),
                    serie = reader.IsDBNull(6) ? reader.GetString(7) : reader.GetString(6),
                    dataCadastro = reader.GetDateTime(9),
                    ativo = reader.GetBoolean(10)
                });
            }

            return Ok(alunos);
        }

        // Busca um aluno
        [HttpGet("{id}")]
        public async Task<IActionResult> GetAluno(int id)
        {
            using SqlConnection connection = new SqlConnection(GetConnectionString());
            await connection.OpenAsync();

            string sql = @"
                SELECT
                    A.IdAluno,
                    A.Nome,
                    A.IdTurma,
                    T.Nome AS Turma,
                    T.Turno,
                    S.IdSerie,
                    S.Nome AS Serie,
                    A.SerieEscolar,
                    A.Turno AS TurnoAntigo,
                    A.DataCadastro,
                    A.Ativo
                FROM Aluno A
                LEFT JOIN Turma T ON T.IdTurma = A.IdTurma
                LEFT JOIN Serie S ON S.IdSerie = T.IdSerie
                WHERE A.IdAluno = @Id";

            using SqlCommand command = new SqlCommand(sql, connection);
            command.Parameters.AddWithValue("@Id", id);

            using SqlDataReader reader = await command.ExecuteReaderAsync();

            if (!await reader.ReadAsync())
                return NotFound(new { mensagem = "Aluno não encontrado." });

            var aluno = new
            {
                idAluno = reader.GetInt32(0),
                nome = reader.GetString(1),
                idTurma = reader.IsDBNull(2) ? (int?)null : reader.GetInt32(2),
                turma = reader.IsDBNull(3) ? null : reader.GetString(3),
                turno = reader.IsDBNull(4) ? reader.GetString(8) : reader.GetString(4),
                idSerie = reader.IsDBNull(5) ? (int?)null : reader.GetInt32(5),
                serie = reader.IsDBNull(6) ? reader.GetString(7) : reader.GetString(6),
                dataCadastro = reader.GetDateTime(9),
                ativo = reader.GetBoolean(10)
            };

            return Ok(aluno);
        }

        // Cadastra aluno
        [HttpPost]
        public async Task<IActionResult> CriarAluno([FromBody] AlunoRequest aluno)
        {
            if (string.IsNullOrWhiteSpace(aluno.Nome))
                return BadRequest(new { mensagem = "O nome é obrigatório." });

            if (aluno.IdTurma <= 0)
                return BadRequest(new { mensagem = "Selecione uma turma." });

            using SqlConnection connection = new SqlConnection(GetConnectionString());
            await connection.OpenAsync();

            // Busca a turma
            string turmaSql = @"
                SELECT T.Nome, T.Turno, S.Nome
                FROM Turma T
                INNER JOIN Serie S ON S.IdSerie = T.IdSerie
                WHERE T.IdTurma = @IdTurma
                  AND T.Ativo = 1
                  AND S.Ativo = 1";

            using SqlCommand turmaCommand = new SqlCommand(turmaSql, connection);
            turmaCommand.Parameters.AddWithValue("@IdTurma", aluno.IdTurma);

            string? turno = null;
            string? serie = null;

            using (SqlDataReader turmaReader = await turmaCommand.ExecuteReaderAsync())
            {
                if (!await turmaReader.ReadAsync())
                    return BadRequest(new { mensagem = "A turma selecionada não existe ou está inativa." });

                turno = turmaReader.GetString(1);
                serie = turmaReader.GetString(2);
            }

            // Cria aluno e matrícula
            using SqlTransaction transaction = connection.BeginTransaction();

            try
            {
                string sql = @"
                    INSERT INTO Aluno
                        (Nome, SerieEscolar, Turno, IdTurma, DataCadastro, Ativo)
                    OUTPUT INSERTED.IdAluno
                    VALUES
                        (@Nome, @SerieEscolar, @Turno, @IdTurma, CAST(GETDATE() AS DATE), 1)";

                using SqlCommand command = new SqlCommand(sql, connection, transaction);

                command.Parameters.AddWithValue("@Nome", aluno.Nome.Trim());
                command.Parameters.AddWithValue("@SerieEscolar", serie);
                command.Parameters.AddWithValue("@Turno", turno);
                command.Parameters.AddWithValue("@IdTurma", aluno.IdTurma);

                int novoId = Convert.ToInt32(await command.ExecuteScalarAsync());

                string matriculaSql = @"
                    INSERT INTO Matricula (IdAluno, DataMatricula, Situacao)
                    VALUES (@IdAluno, CAST(GETDATE() AS DATE), 'Matriculado')";

                using SqlCommand matriculaCommand = new SqlCommand(matriculaSql, connection, transaction);
                matriculaCommand.Parameters.AddWithValue("@IdAluno", novoId);

                await matriculaCommand.ExecuteNonQueryAsync();
                await transaction.CommitAsync();

                return CreatedAtAction(
                    nameof(GetAluno),
                    new { id = novoId },
                    new
                    {
                        idAluno = novoId,
                        nome = aluno.Nome.Trim(),
                        idTurma = aluno.IdTurma,
                        serie,
                        turno,
                        ativo = true
                    }
                );
            }
            catch (Exception error)
            {
                await transaction.RollbackAsync();

                return StatusCode(500, new
                {
                    mensagem = "Não foi possível cadastrar o aluno e sua matrícula.",
                    detalhe = error.Message
                });
            }
        }

        // Edita aluno
        [HttpPut("{id}")]
        public async Task<IActionResult> EditarAluno(int id, [FromBody] AlunoRequest aluno)
        {
            if (string.IsNullOrWhiteSpace(aluno.Nome))
                return BadRequest(new { mensagem = "O nome é obrigatório." });

            if (aluno.IdTurma <= 0)
                return BadRequest(new { mensagem = "Selecione uma turma." });

            using SqlConnection connection = new SqlConnection(GetConnectionString());
            await connection.OpenAsync();

            // Busca série e turno
            string turmaSql = @"
                SELECT T.Turno, S.Nome
                FROM Turma T
                INNER JOIN Serie S ON S.IdSerie = T.IdSerie
                WHERE T.IdTurma = @IdTurma
                  AND T.Ativo = 1
                  AND S.Ativo = 1";

            using SqlCommand turmaCommand = new SqlCommand(turmaSql, connection);
            turmaCommand.Parameters.AddWithValue("@IdTurma", aluno.IdTurma);

            string? turno = null;
            string? serie = null;

            using (SqlDataReader turmaReader = await turmaCommand.ExecuteReaderAsync())
            {
                if (!await turmaReader.ReadAsync())
                    return BadRequest(new { mensagem = "A turma selecionada não existe ou está inativa." });

                turno = turmaReader.GetString(0);
                serie = turmaReader.GetString(1);
            }

            string sql = @"
                UPDATE Aluno
                SET
                    Nome = @Nome,
                    IdTurma = @IdTurma,
                    SerieEscolar = @SerieEscolar,
                    Turno = @Turno
                WHERE IdAluno = @Id";

            using SqlCommand command = new SqlCommand(sql, connection);

            command.Parameters.AddWithValue("@Id", id);
            command.Parameters.AddWithValue("@Nome", aluno.Nome.Trim());
            command.Parameters.AddWithValue("@IdTurma", aluno.IdTurma);
            command.Parameters.AddWithValue("@SerieEscolar", serie);
            command.Parameters.AddWithValue("@Turno", turno);

            int linhasAlteradas = await command.ExecuteNonQueryAsync();

            if (linhasAlteradas == 0)
                return NotFound(new { mensagem = "Aluno não encontrado." });

            return Ok(new { mensagem = "Aluno atualizado com sucesso." });
        }

        // Exclui aluno
        [HttpDelete("{id}")]
        public async Task<IActionResult> ExcluirAluno(int id)
        {
            using SqlConnection connection = new SqlConnection(GetConnectionString());
            await connection.OpenAsync();

            // Verifica se existe
            string verificarSql = @"
                SELECT COUNT(*)
                FROM Aluno
                WHERE IdAluno = @Id";

            using SqlCommand verificar = new SqlCommand(verificarSql, connection);
            verificar.Parameters.AddWithValue("@Id", id);

            int existe = Convert.ToInt32(await verificar.ExecuteScalarAsync());

            if (existe == 0)
                return NotFound(new { mensagem = "Aluno não encontrado." });

            // Exclui presença, matrícula e aluno
            string sql = @"
                DELETE FROM Presenca
                WHERE IdMatricula IN
                (
                    SELECT IdMatricula
                    FROM Matricula
                    WHERE IdAluno = @Id
                );

                DELETE FROM Matricula
                WHERE IdAluno = @Id;

                DELETE FROM Aluno
                WHERE IdAluno = @Id;";

            using SqlCommand command = new SqlCommand(sql, connection);
            command.Parameters.AddWithValue("@Id", id);

            await command.ExecuteNonQueryAsync();

            return Ok(new { mensagem = "Aluno excluído com sucesso." });
        }
    }

    public class AlunoRequest
    {
        public string Nome { get; set; } = "";
        public int IdTurma { get; set; }
    }
}