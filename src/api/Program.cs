var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.MapGet("/", () => "Unified SaaS Pipeline API");

app.Run();
