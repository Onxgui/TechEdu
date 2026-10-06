var builder = WebApplication.CreateBuilder(args);

// Adiciona os Controllers
builder.Services.AddControllers();

// OpenAPI
builder.Services.AddOpenApi();

// Permite que o site HTML/JS acesse a API
builder.Services.AddCors(options =>
{
    options.AddPolicy("PermitirSite", policy =>
    {
        policy
            .AllowAnyOrigin()
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

// OpenAPI apenas em desenvolvimento
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

// Ativa o CORS
app.UseCors("PermitirSite");

app.UseAuthorization();

app.MapControllers();

app.Run();