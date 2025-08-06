#!/bin/bash

# CTEH Platform Deployment Script
# This script deploys the Cognizant Talent & Engagement Hub to Azure App Services
# Usage: ./scripts/deploy.sh [environment] [resource-group] [app-name]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
NODE_VERSION="18"

# Default values
DEFAULT_ENVIRONMENT="staging"
DEFAULT_RESOURCE_GROUP="rg-cteh-staging"
DEFAULT_APP_NAME="cteh-platform"
DEFAULT_LOCATION="East US"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Help function
show_help() {
    cat << EOF
CTEH Platform Deployment Script

Usage: $0 [OPTIONS]

Options:
    -e, --environment ENV       Deployment environment (development|staging|production)
    -g, --resource-group RG     Azure resource group name
    -a, --app-name NAME         Azure app service name
    -l, --location LOCATION     Azure region
    -s, --subscription SUB      Azure subscription ID
    -h, --help                  Show this help message

Environment Variables:
    AZURE_SUBSCRIPTION_ID       Azure subscription ID
    AZURE_CLIENT_ID             Azure service principal client ID
    AZURE_CLIENT_SECRET         Azure service principal client secret
    AZURE_TENANT_ID             Azure tenant ID

Examples:
    $0 -e production -g rg-cteh-prod -a cteh-platform-prod
    $0 --environment staging --resource-group rg-cteh-staging
    $0 # Uses default values for staging deployment

EOF
}

# Parse command line arguments
parse_args() {
    ENVIRONMENT="$DEFAULT_ENVIRONMENT"
    RESOURCE_GROUP="$DEFAULT_RESOURCE_GROUP"
    APP_NAME="$DEFAULT_APP_NAME"
    LOCATION="$DEFAULT_LOCATION"
    SUBSCRIPTION_ID=""

    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -g|--resource-group)
                RESOURCE_GROUP="$2"
                shift 2
                ;;
            -a|--app-name)
                APP_NAME="$2"
                shift 2
                ;;
            -l|--location)
                LOCATION="$2"
                shift 2
                ;;
            -s|--subscription)
                SUBSCRIPTION_ID="$2"
                shift 2
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done

    # Validate environment
    if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
        log_error "Invalid environment: $ENVIRONMENT. Must be development, staging, or production."
        exit 1
    fi

    # Set subscription ID from environment if not provided
    if [[ -z "$SUBSCRIPTION_ID" && -n "${AZURE_SUBSCRIPTION_ID:-}" ]]; then
        SUBSCRIPTION_ID="$AZURE_SUBSCRIPTION_ID"
    fi
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if Azure CLI is installed
    if ! command -v az &> /dev/null; then
        log_error "Azure CLI is not installed. Please install it from https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
        exit 1
    fi

    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js $NODE_VERSION or later."
        exit 1
    fi

    # Check Node.js version
    NODE_CURRENT_VERSION=$(node -v | sed 's/v//')
    if ! npx semver "$NODE_CURRENT_VERSION" -r ">=$NODE_VERSION" &> /dev/null; then
        log_error "Node.js version $NODE_CURRENT_VERSION is not supported. Please install Node.js $NODE_VERSION or later."
        exit 1
    fi

    # Check if npm is installed
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed. Please install npm."
        exit 1
    fi

    # Check if Docker is installed (for container deployment)
    if ! command -v docker &> /dev/null; then
        log_warning "Docker is not installed. Container deployment will be skipped."
    fi

    log_success "Prerequisites check completed"
}

# Azure login and setup
azure_login() {
    log_info "Checking Azure authentication..."

    # Check if already logged in
    if ! az account show &> /dev/null; then
        log_info "Not logged in to Azure. Starting login process..."
        az login
    fi

    # Set subscription if provided
    if [[ -n "$SUBSCRIPTION_ID" ]]; then
        log_info "Setting Azure subscription: $SUBSCRIPTION_ID"
        az account set --subscription "$SUBSCRIPTION_ID"
    fi

    # Verify current subscription
    CURRENT_SUB=$(az account show --query "id" -o tsv)
    CURRENT_SUB_NAME=$(az account show --query "name" -o tsv)
    log_info "Using Azure subscription: $CURRENT_SUB_NAME ($CURRENT_SUB)"
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."

    cd "$PROJECT_ROOT"

    # Install backend dependencies
    log_info "Installing backend dependencies..."
    npm ci --production=false

    # Install frontend dependencies
    log_info "Installing frontend dependencies..."
    cd client
    npm ci --production=false
    cd ..

    log_success "Dependencies installed"
}

# Run tests
run_tests() {
    log_info "Running tests..."

    cd "$PROJECT_ROOT"

    # Lint backend
    log_info "Linting backend code..."
    npm run lint

    # Lint frontend
    log_info "Linting frontend code..."
    cd client
    npm run lint
    cd ..

    # Type check backend
    log_info "Type checking backend..."
    npx tsc --noEmit

    # Type check frontend
    log_info "Type checking frontend..."
    cd client
    npm run type-check
    cd ..

    # Run backend tests
    log_info "Running backend tests..."
    npm run test -- --coverage --watchAll=false --ci

    # Run frontend tests
    log_info "Running frontend tests..."
    cd client
    npm run test -- --coverage --run
    cd ..

    log_success "All tests passed"
}

# Build application
build_application() {
    log_info "Building application..."

    cd "$PROJECT_ROOT"

    # Build the application
    NODE_ENV=production npm run build

    log_success "Application built successfully"
}

# Deploy infrastructure
deploy_infrastructure() {
    log_info "Deploying Azure infrastructure..."

    cd "$PROJECT_ROOT"

    # Create resource group if it doesn't exist
    log_info "Creating resource group: $RESOURCE_GROUP"
    az group create \
        --name "$RESOURCE_GROUP" \
        --location "$LOCATION" \
        --tags Environment="$ENVIRONMENT" Application="CTEH" Owner="Cognizant"

    # Deploy ARM template
    log_info "Deploying ARM template..."
    DEPLOYMENT_NAME="cteh-infrastructure-$(date +%Y%m%d-%H%M%S)"
    
    az deployment group create \
        --resource-group "$RESOURCE_GROUP" \
        --template-file azure-deploy.json \
        --parameters \
            appName="$APP_NAME" \
            environment="$ENVIRONMENT" \
            location="$LOCATION" \
            skuName="S1" \
        --name "$DEPLOYMENT_NAME"

    # Get deployment outputs
    WEB_APP_URL=$(az deployment group show \
        --resource-group "$RESOURCE_GROUP" \
        --name "$DEPLOYMENT_NAME" \
        --query "properties.outputs.webAppUrl.value" -o tsv)

    CDN_URL=$(az deployment group show \
        --resource-group "$RESOURCE_GROUP" \
        --name "$DEPLOYMENT_NAME" \
        --query "properties.outputs.cdnEndpointUrl.value" -o tsv)

    log_success "Infrastructure deployed successfully"
    log_info "Web App URL: $WEB_APP_URL"
    log_info "CDN URL: $CDN_URL"
}

# Deploy application
deploy_application() {
    log_info "Deploying application to Azure App Service..."

    cd "$PROJECT_ROOT"

    # Create deployment package
    log_info "Creating deployment package..."
    DEPLOYMENT_PACKAGE="cteh-deployment-$(date +%Y%m%d-%H%M%S).zip"
    
    # Create a temporary directory for deployment files
    TEMP_DIR=$(mktemp -d)
    
    # Copy necessary files
    cp -r dist/ "$TEMP_DIR/"
    cp -r client/dist/ "$TEMP_DIR/public/"
    cp package.json "$TEMP_DIR/"
    cp package-lock.json "$TEMP_DIR/"
    
    # Create web.config for Azure App Service
    cat > "$TEMP_DIR/web.config" << 'EOF'
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <handlers>
      <add name="iisnode" path="dist/server.js" verb="*" modules="iisnode"/>
    </handlers>
    <rewrite>
      <rules>
        <rule name="StaticContent">
          <action type="Rewrite" url="public{REQUEST_URI}"/>
        </rule>
        <rule name="DynamicContent">
          <conditions>
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="True"/>
          </conditions>
          <action type="Rewrite" url="dist/server.js"/>
        </rule>
      </rules>
    </rewrite>
    <iisnode
      node_env="production"
      nodeProcessCommandLine="node"
      interceptor="iisnode/interceptor.js"
      watchedFiles="web.config;*.js"
      loggingEnabled="true"
      logDirectoryNameSuffix="logs"
      debuggingEnabled="false"
      maxConcurrentRequestsPerProcess="1024"
      maxNamedPipeConnectionRetry="3"
      namedPipeConnectionRetryDelay="2000"
      asyncCompletionThreadCount="0"
      initialRequestBufferSize="4096"
      maxRequestBufferSize="65536"
      uncFileChangesPollingInterval="5000"
      gracefulShutdownTimeout="60000"
      loggingEnabled="true"
      logDirectoryNameSuffix="iisnode"
      maxLogFileSizeInKB="128"
      appendToExistingLog="false"
      logFileFlushInterval="5000"
      devErrorsEnabled="false"
      flushResponse="false"
      enableXFF="false"
      promoteServerVars="" />
  </system.webServer>
</configuration>
EOF

    # Create the deployment package
    cd "$TEMP_DIR"
    zip -r "$PROJECT_ROOT/$DEPLOYMENT_PACKAGE" .
    cd "$PROJECT_ROOT"
    
    # Clean up temp directory
    rm -rf "$TEMP_DIR"

    # Deploy to Azure App Service
    log_info "Deploying to Azure App Service: $APP_NAME-$ENVIRONMENT"
    az webapp deployment source config-zip \
        --resource-group "$RESOURCE_GROUP" \
        --name "$APP_NAME-$ENVIRONMENT" \
        --src "$DEPLOYMENT_PACKAGE"

    # Clean up deployment package
    rm "$DEPLOYMENT_PACKAGE"

    # Configure app settings
    log_info "Configuring application settings..."
    az webapp config appsettings set \
        --resource-group "$RESOURCE_GROUP" \
        --name "$APP_NAME-$ENVIRONMENT" \
        --settings \
            NODE_ENV="$ENVIRONMENT" \
            WEBSITES_PORT=3000 \
            WEBSITES_NODE_DEFAULT_VERSION="~$NODE_VERSION" \
            WEBSITE_RUN_FROM_PACKAGE=1

    log_success "Application deployed successfully"
}

# Run health checks
health_check() {
    log_info "Running health checks..."

    # Wait for application to start
    log_info "Waiting for application to start..."
    sleep 30

    # Get app URL
    APP_URL="https://$APP_NAME-$ENVIRONMENT.azurewebsites.net"
    
    # Health check
    log_info "Testing health endpoint: $APP_URL/health"
    for i in {1..5}; do
        if curl -f -s "$APP_URL/health" > /dev/null; then
            log_success "Health check passed"
            break
        else
            log_warning "Health check failed, retrying... (attempt $i/5)"
            sleep 10
        fi
        
        if [[ $i -eq 5 ]]; then
            log_error "Health check failed after 5 attempts"
            exit 1
        fi
    done

    # API status check
    log_info "Testing API status endpoint: $APP_URL/api/v1/status"
    if curl -f -s "$APP_URL/api/v1/status" > /dev/null; then
        log_success "API status check passed"
    else
        log_error "API status check failed"
        exit 1
    fi

    # Warm up key endpoints
    log_info "Warming up application endpoints..."
    ENDPOINTS=(
        "/"
        "/api/v1/auth/status"
        "/api/v1/skills"
        "/api/v1/users/profile"
    )

    for endpoint in "${ENDPOINTS[@]}"; do
        log_info "Warming up: $APP_URL$endpoint"
        curl -s "$APP_URL$endpoint" > /dev/null || log_warning "Could not warm up $endpoint"
    done

    log_success "Health checks completed"
    log_success "Application is available at: $APP_URL"
}

# Main deployment function
main() {
    echo "🚀 CTEH Platform Deployment Script"
    echo "=================================="
    
    parse_args "$@"
    
    log_info "Deployment Configuration:"
    log_info "  Environment: $ENVIRONMENT"
    log_info "  Resource Group: $RESOURCE_GROUP"
    log_info "  App Name: $APP_NAME"
    log_info "  Location: $LOCATION"
    
    # Confirmation prompt for production
    if [[ "$ENVIRONMENT" == "production" ]]; then
        echo
        log_warning "You are about to deploy to PRODUCTION environment!"
        read -p "Are you sure you want to continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Deployment cancelled"
            exit 0
        fi
    fi

    # Run deployment steps
    check_prerequisites
    azure_login
    install_dependencies
    run_tests
    build_application
    deploy_infrastructure
    deploy_application
    health_check

    echo
    log_success "🎉 Deployment completed successfully!"
    log_success "Application URL: https://$APP_NAME-$ENVIRONMENT.azurewebsites.net"
    log_success "Health Check: https://$APP_NAME-$ENVIRONMENT.azurewebsites.net/health"
    log_success "API Status: https://$APP_NAME-$ENVIRONMENT.azurewebsites.net/api/v1/status"
}

# Run main function with all arguments
main "$@"