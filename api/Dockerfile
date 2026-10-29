# Builds the API image for Render (or any container host).
# Build context: the api/ folder.

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore first so package downloads are cached between builds.
COPY Directory.Build.props Directory.Packages.props ./
COPY src/YtPlaylist.Domain/YtPlaylist.Domain.csproj src/YtPlaylist.Domain/
COPY src/YtPlaylist.Application/YtPlaylist.Application.csproj src/YtPlaylist.Application/
COPY src/YtPlaylist.Infrastructure/YtPlaylist.Infrastructure.csproj src/YtPlaylist.Infrastructure/
COPY src/YtPlaylist.Api/YtPlaylist.Api.csproj src/YtPlaylist.Api/
RUN dotnet restore src/YtPlaylist.Api/YtPlaylist.Api.csproj

COPY src/ src/
RUN dotnet publish src/YtPlaylist.Api/YtPlaylist.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app ./
ENV ASPNETCORE_ENVIRONMENT=Production
# Render sets PORT; the app listens on it (see Program.cs). 8080 is the image default otherwise.
EXPOSE 8080
USER $APP_UID
ENTRYPOINT ["dotnet", "YtPlaylist.Api.dll"]
