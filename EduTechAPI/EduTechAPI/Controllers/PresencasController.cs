using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace TechEduAPI.Controllers
{
    [ApiController]
    [Route("api/presencas")]
    public class PresencasController : ControllerBase
    {
        private readonly IConfiguration _configuration;

        public PresencasController(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        private string GetConnectionString()
        {
            return _configuration.GetConnectionString("TechEdu")!;
        }

        // Lista as presenças
        [HttpGet]
        public async Task<IActionResult> GetPresencas()
        {
            var presencas = new List<object>();

            using SqlConnection connection = new SqlConnection(GetConnectionString());
            await connection.OpenAsync();

            string sql = @"
                SELECT
                    P.IdPresenca,
                    A.IdAluno,
                    A.Nome,
                    P.IdMatricula,
                    P.IdAula,
                    AU.DataAula,
                    AU.Conteudo,
                    P.Situacao,
                    P.Observacao,
                    T.IdTurma,
                    T.Nome AS Turma,
                    T.Turno,
                    S.IdSerie,
                    S.Nome AS Serie
                FROM Presenca P
                INNER JOIN Matricula M ON M.IdMatricula = P.IdMatricula
                INNER JOIN Aluno A ON A.IdAluno = M.IdAluno
                INNER JOIN Aula AU ON AU.IdAula = P.IdAula
                LEFT JOIN Turma T ON T.IdTurma = A.IdTurma
                LEFT JOIN Serie S ON S.IdSerie = T.IdSerie
                ORDER BY AU.DataAula DESC, A.Nome";

            using SqlCommand command = new SqlCommand(sql, connection);
            using SqlDataReader reader = await command.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                presencas.Add(new
                {
                    idPresenca = reader.GetInt32(0),
                    idAluno = reader.GetInt32(1),
                    nome = reader.GetString(2),
                    idMatricula = reader.GetInt32(3),
                    idAula = reader.GetInt32(4),
                    dataAula = reader.GetDateTime(5),
                    conteudo = reader.GetString(6),
                    situacao = reader.GetString(7),
                    observacao = reader.IsDBNull(8) ? null : reader.GetString(8),
                    idTurma = reader.IsDBNull(9) ? (int?)null : reader.GetInt32(9),
                    turma = reader.IsDBNull(10) ? null : reader.GetString(10),
                    turno = reader.IsDBNull(11) ? null : reader.GetString(11),
                    idSerie = reader.IsDBNull(12) ? (int?)null : reader.GetInt32(12),
                    serie = reader.IsDBNull(13) ? null : reader.GetString(13)
                });
            }

            return Ok(presencas);
        }

        // Salva a chamada
        [HttpPost("chamada")]
        public async Task<IActionResult> SalvarChamada([FromBody] ChamadaRequest chamada)
        {
            if (chamada.Data == default)
                return BadRequest(new { mensagem = "Informe a data da aula." });

            if (string.IsNullOrWhiteSpace(chamada.Conteudo))
                return BadRequest(new { mensagem = "Informe o conteúdo da aula." });

            if (chamada.Presencas == null || chamada.Presencas.Count == 0)
                return BadRequest(new { mensagem = "A chamada não possui alunos." });

            using SqlConnection connection = new SqlConnection(GetConnectionString());
            await connection.OpenAsync();

            using SqlTransaction transaction = connection.BeginTransaction();

            try
            {
                // Procura a aula
                string procurarAulaSql = @"
                    SELECT TOP 1 IdAula
                    FROM Aula
                    WHERE DataAula = @DataAula
                      AND Conteudo = @Conteudo
                    ORDER BY IdAula DESC";

                using SqlCommand procurarAulaCommand =
                    new SqlCommand(procurarAulaSql, connection, transaction);

                procurarAulaCommand.Parameters.AddWithValue("@DataAula", chamada.Data.Date);
                procurarAulaCommand.Parameters.AddWithValue("@Conteudo", chamada.Conteudo.Trim());

                object? aulaExistente = await procurarAulaCommand.ExecuteScalarAsync();
                int idAula;

                // Cria a aula se necessário
                if (aulaExistente == null || aulaExistente == DBNull.Value)
                {
                    string criarAulaSql = @"
                        INSERT INTO Aula
                            (DataAula, HoraInicio, HoraFim, Conteudo, Observacao, IdAdministrador)
                        OUTPUT INSERTED.IdAula
                        VALUES
                            (@DataAula, NULL, NULL, @Conteudo, NULL, NULL)";

                    using SqlCommand criarAulaCommand =
                        new SqlCommand(criarAulaSql, connection, transaction);

                    criarAulaCommand.Parameters.AddWithValue("@DataAula", chamada.Data.Date);
                    criarAulaCommand.Parameters.AddWithValue("@Conteudo", chamada.Conteudo.Trim());

                    idAula = Convert.ToInt32(await criarAulaCommand.ExecuteScalarAsync());
                }
                else
                {
                    idAula = Convert.ToInt32(aulaExistente);
                }

                // Salva cada presença
                foreach (ChamadaAlunoRequest item in chamada.Presencas)
                {
                    string matriculaSql = @"
                        SELECT TOP 1 IdMatricula
                        FROM Matricula
                        WHERE IdAluno = @IdAluno
                          AND Situacao = 'Matriculado'
                        ORDER BY IdMatricula DESC";

                    using SqlCommand matriculaCommand =
                        new SqlCommand(matriculaSql, connection, transaction);

                    matriculaCommand.Parameters.AddWithValue("@IdAluno", item.IdAluno);

                    object? matriculaResult = await matriculaCommand.ExecuteScalarAsync();

                    if (matriculaResult == null || matriculaResult == DBNull.Value)
                        throw new Exception(
                            $"O aluno de ID {item.IdAluno} não possui matrícula ativa."
                        );

                    int idMatricula = Convert.ToInt32(matriculaResult);
                    string situacao = item.Presente ? "Presente" : "Falta";

                    // Verifica se já existe
                    string verificarSql = @"
                        SELECT TOP 1 IdPresenca
                        FROM Presenca
                        WHERE IdMatricula = @IdMatricula
                          AND IdAula = @IdAula";

                    using SqlCommand verificarCommand =
                        new SqlCommand(verificarSql, connection, transaction);

                    verificarCommand.Parameters.AddWithValue("@IdMatricula", idMatricula);
                    verificarCommand.Parameters.AddWithValue("@IdAula", idAula);

                    object? presencaExistente = await verificarCommand.ExecuteScalarAsync();

                    if (presencaExistente != null && presencaExistente != DBNull.Value)
                    {
                        string atualizarSql = @"
                            UPDATE Presenca
                            SET Situacao = @Situacao
                            WHERE IdPresenca = @IdPresenca";

                        using SqlCommand atualizarCommand =
                            new SqlCommand(atualizarSql, connection, transaction);

                        atualizarCommand.Parameters.AddWithValue("@Situacao", situacao);
                        atualizarCommand.Parameters.AddWithValue(
                            "@IdPresenca", Convert.ToInt32(presencaExistente)
                        );

                        await atualizarCommand.ExecuteNonQueryAsync();
                    }
                    else
                    {
                        string inserirSql = @"
                            INSERT INTO Presenca
                                (IdMatricula, IdAula, Situacao, Observacao)
                            VALUES
                                (@IdMatricula, @IdAula, @Situacao, NULL)";

                        using SqlCommand inserirCommand =
                            new SqlCommand(inserirSql, connection, transaction);

                        inserirCommand.Parameters.AddWithValue("@IdMatricula", idMatricula);
                        inserirCommand.Parameters.AddWithValue("@IdAula", idAula);
                        inserirCommand.Parameters.AddWithValue("@Situacao", situacao);

                        await inserirCommand.ExecuteNonQueryAsync();
                    }
                }

                await transaction.CommitAsync();

                return Ok(new
                {
                    mensagem = "Chamada salva com sucesso.",
                    idAula,
                    quantidade = chamada.Presencas.Count
                });
            }
            catch (Exception error)
            {
                await transaction.RollbackAsync();

                return StatusCode(500, new
                {
                    mensagem = "Não foi possível salvar a chamada.",
                    detalhe = error.Message
                });
            }
        }

        // Edita uma presença
        [HttpPut("{id}")]
        public async Task<IActionResult> EditarPresenca(
            int id, [FromBody] EditarPresencaRequest request)
        {
            if (request.Data == default)
                return BadRequest(new { mensagem = "Informe a data da aula." });

            if (string.IsNullOrWhiteSpace(request.Conteudo))
                return BadRequest(new { mensagem = "Informe o conteúdo da aula." });

            using SqlConnection connection = new SqlConnection(GetConnectionString());
            await connection.OpenAsync();

            using SqlTransaction transaction = connection.BeginTransaction();

            try
            {
                // Busca a presença
                string buscarPresencaSql = @"
                    SELECT IdMatricula, IdAula
                    FROM Presenca
                    WHERE IdPresenca = @IdPresenca";

                using SqlCommand buscarPresencaCommand =
                    new SqlCommand(buscarPresencaSql, connection, transaction);

                buscarPresencaCommand.Parameters.AddWithValue("@IdPresenca", id);

                int idMatricula;
                int idAulaAtual;

                using (SqlDataReader reader = await buscarPresencaCommand.ExecuteReaderAsync())
                {
                    if (!await reader.ReadAsync())
                    {
                        await reader.CloseAsync();
                        await transaction.RollbackAsync();

                        return NotFound(new
                        {
                            mensagem = "Registro de presença não encontrado."
                        });
                    }

                    idMatricula = reader.GetInt32(0);
                    idAulaAtual = reader.GetInt32(1);
                }

                // Procura a nova aula
                string procurarAulaSql = @"
                    SELECT TOP 1 IdAula
                    FROM Aula
                    WHERE DataAula = @DataAula
                      AND Conteudo = @Conteudo
                    ORDER BY IdAula DESC";

                using SqlCommand procurarAulaCommand =
                    new SqlCommand(procurarAulaSql, connection, transaction);

                procurarAulaCommand.Parameters.AddWithValue("@DataAula", request.Data.Date);
                procurarAulaCommand.Parameters.AddWithValue("@Conteudo", request.Conteudo.Trim());

                object? aulaResult = await procurarAulaCommand.ExecuteScalarAsync();
                int idNovaAula;

                if (aulaResult != null && aulaResult != DBNull.Value)
                {
                    idNovaAula = Convert.ToInt32(aulaResult);
                }
                else
                {
                    // Cria uma nova aula
                    string criarAulaSql = @"
                        INSERT INTO Aula
                            (DataAula, HoraInicio, HoraFim, Conteudo, Observacao, IdAdministrador)
                        OUTPUT INSERTED.IdAula
                        VALUES
                            (@DataAula, NULL, NULL, @Conteudo, NULL, NULL)";

                    using SqlCommand criarAulaCommand =
                        new SqlCommand(criarAulaSql, connection, transaction);

                    criarAulaCommand.Parameters.AddWithValue("@DataAula", request.Data.Date);
                    criarAulaCommand.Parameters.AddWithValue("@Conteudo", request.Conteudo.Trim());

                    idNovaAula = Convert.ToInt32(await criarAulaCommand.ExecuteScalarAsync());
                }

                // Evita presença duplicada
                string verificarDuplicidadeSql = @"
                    SELECT TOP 1 IdPresenca
                    FROM Presenca
                    WHERE IdMatricula = @IdMatricula
                      AND IdAula = @IdAula
                      AND IdPresenca <> @IdPresenca";

                using SqlCommand verificarDuplicidadeCommand =
                    new SqlCommand(verificarDuplicidadeSql, connection, transaction);

                verificarDuplicidadeCommand.Parameters.AddWithValue("@IdMatricula", idMatricula);
                verificarDuplicidadeCommand.Parameters.AddWithValue("@IdAula", idNovaAula);
                verificarDuplicidadeCommand.Parameters.AddWithValue("@IdPresenca", id);

                object? duplicado = await verificarDuplicidadeCommand.ExecuteScalarAsync();

                if (duplicado != null && duplicado != DBNull.Value)
                {
                    await transaction.RollbackAsync();

                    return Conflict(new
                    {
                        mensagem = "Este aluno já possui um registro de presença para essa aula."
                    });
                }

                string situacao = request.Presente ? "Presente" : "Falta";

                // Atualiza a presença
                string atualizarSql = @"
                    UPDATE Presenca
                    SET
                        IdAula = @IdAula,
                        Situacao = @Situacao
                    WHERE IdPresenca = @IdPresenca";

                using SqlCommand atualizarCommand =
                    new SqlCommand(atualizarSql, connection, transaction);

                atualizarCommand.Parameters.AddWithValue("@IdAula", idNovaAula);
                atualizarCommand.Parameters.AddWithValue("@Situacao", situacao);
                atualizarCommand.Parameters.AddWithValue("@IdPresenca", id);

                int linhas = await atualizarCommand.ExecuteNonQueryAsync();

                if (linhas == 0)
                {
                    await transaction.RollbackAsync();
                    return NotFound(new { mensagem = "Registro de presença não encontrado." });
                }

                await transaction.CommitAsync();

                return Ok(new
                {
                    mensagem = "Presença atualizada com sucesso.",
                    idPresenca = id,
                    idAulaAnterior = idAulaAtual,
                    idAula = idNovaAula,
                    situacao
                });
            }
            catch (Exception error)
            {
                await transaction.RollbackAsync();

                return StatusCode(500, new
                {
                    mensagem = "Não foi possível atualizar a presença.",
                    detalhe = error.Message
                });
            }
        }

        // Exclui uma presença
        [HttpDelete("{id}")]
        public async Task<IActionResult> ExcluirPresenca(int id)
        {
            using SqlConnection connection = new SqlConnection(GetConnectionString());
            await connection.OpenAsync();

            string sql = @"
                DELETE FROM Presenca
                WHERE IdPresenca = @Id";

            using SqlCommand command = new SqlCommand(sql, connection);
            command.Parameters.AddWithValue("@Id", id);

            int linhas = await command.ExecuteNonQueryAsync();

            if (linhas == 0)
                return NotFound(new { mensagem = "Registro de presença não encontrado." });

            return Ok(new { mensagem = "Presença excluída com sucesso." });
        }

        // Exclui todas as presenças
        [HttpDelete]
        public async Task<IActionResult> ExcluirTodasPresencas()
        {
            using SqlConnection connection = new SqlConnection(GetConnectionString());
            await connection.OpenAsync();

            string sql = "DELETE FROM Presenca";

            using SqlCommand command = new SqlCommand(sql, connection);
            int quantidade = await command.ExecuteNonQueryAsync();

            return Ok(new
            {
                mensagem = "Todos os registros de presença foram excluídos.",
                quantidade
            });
        }
    }

    public class ChamadaRequest
    {
        public DateTime Data { get; set; }
        public string Conteudo { get; set; } = "";
        public List<ChamadaAlunoRequest> Presencas { get; set; } = new();
    }

    public class ChamadaAlunoRequest
    {
        public int IdAluno { get; set; }
        public bool Presente { get; set; }
    }

    public class EditarPresencaRequest
    {
        public DateTime Data { get; set; }
        public string Conteudo { get; set; } = "";
        public bool Presente { get; set; }
    }
}