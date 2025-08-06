# 🚀 CTEH Platform Deployment Guide

This document provides comprehensive instructions for deploying the Cognizant Talent & Engagement Hub (CTEH) platform to Azure App Services.

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Deployment Methods](#deployment-methods)
- [Environment Configuration](#environment-configuration)
- [Infrastructure Setup](#infrastructure-setup)
- [Application Deployment](#application-deployment)
- [Post-Deployment Verification](#post-deployment-verification)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Troubleshooting](#troubleshooting)
- [Security Considerations](#security-considerations)

## 🔧 Prerequisites

### Required Tools

1. **Azure CLI** (v2.40+)
   ```bash
   # Install Azure CLI
   curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
   
   # Verify installation
   az --version
   ```

2. **Node.js** (v18.x LTS)
   ```bash
   # Install Node.js using nvm
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   nvm install 18
   nvm use 18
   ```

3. **Docker** (v20.10+) - Optional for container deployment
   ```bash
   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   ```

4. **Git**
   ```bash
   # Install Git
   sudo apt-get install git
   ```

### Azure Resources Required

- Azure Subscription with appropriate permissions
- Resource Group
- App Service Plan
- Azure App Service
- Azure Cosmos DB (MongoDB API)
- Azure Cache for Redis
- Azure Storage Account
- Azure Key Vault
- Azure Application Insights
- Azure Service Bus (Optional)
- Azure CDN (Optional)

### Service Principal Setup

Create a service principal for automated deployments:

```bash
# Create service principal
az ad sp create-for-rbac --name "cteh-deployment-sp" \
  --role contributor \
  --scopes /subscriptions/{subscription-id} \
  --sdk-auth

# Save the output - you'll need it for GitHub Actions/Azure DevOps
```

## ⚡ Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/cognizant/talent-engagement-hub.git
cd talent-engagement-hub
```

### 2. Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

### 3. Deploy Using Script
```bash
# Make deployment script executable
chmod +x scripts/deploy.sh

# Deploy to staging
./scripts/deploy.sh -e staging -g rg-cteh-staging -a cteh-platform

# Deploy to production
./scripts/deploy.sh -e production -g rg-cteh-prod -a cteh-platform
```

## 🔄 Deployment Methods

### Method 1: Automated CI/CD (Recommended)

#### GitHub Actions
1. Fork the repository
2. Configure repository secrets:
   ```
   AZURE_CREDENTIALS
   AZURE_SUBSCRIPTION_ID
   AZURE_LOCATION
   ACR_USERNAME
   ACR_PASSWORD
   SLACK_WEBHOOK_URL (optional)
   TEAMS_WEBHOOK_URL (optional)
   ```
3. Push to `main` or `develop` branch to trigger deployment

#### Azure DevOps
1. Import the repository to Azure DevOps
2. Create a new pipeline using `azure-pipelines.yml`
3. Configure pipeline variables and service connections
4. Run the pipeline

### Method 2: Manual Deployment Script

Use the provided deployment script for manual deployments:

```bash
# Basic deployment
./scripts/deploy.sh

# Custom environment deployment
./scripts/deploy.sh -e production -g rg-cteh-prod -a cteh-platform-prod -l "East US"

# With custom subscription
./scripts/deploy.sh -e staging -s "your-subscription-id"
```

### Method 3: Manual Step-by-Step

For complete control over the deployment process:

1. **Build Application**
   ```bash
   npm install
   cd client && npm install && cd ..
   npm run build
   ```

2. **Deploy Infrastructure**
   ```bash
   az group create --name rg-cteh-prod --location "East US"
   az deployment group create \
     --resource-group rg-cteh-prod \
     --template-file azure-deploy.json \
     --parameters appName=cteh-platform environment=production
   ```

3. **Deploy Application**
   ```bash
   zip -r deployment.zip dist/ client/dist/ package.json
   az webapp deployment source config-zip \
     --resource-group rg-cteh-prod \
     --name cteh-platform-production \
     --src deployment.zip
   ```

## 🔧 Environment Configuration

### Environment Files

Create environment-specific configuration files:

- `.env.development` - Development environment
- `.env.staging` - Staging environment  
- `.env.production` - Production environment

### Key Configuration Variables

#### Required Variables
```bash
# Database
MONGODB_URI=mongodb://your-cosmos-db-connection-string
REDIS_URL=redis://your-redis-cache-url

# Authentication
JWT_SECRET=your-super-secret-jwt-key
SESSION_SECRET=your-session-secret

# Azure Services
AZURE_STORAGE_CONNECTION_STRING=your-storage-connection
APPLICATIONINSIGHTS_CONNECTION_STRING=your-insights-connection
```

#### Optional Variables
```bash
# AI Services
OPENAI_API_KEY=your-openai-key

# Email Services
SMTP_HOST=smtp.sendgrid.net
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key

# Third-party Integrations
SLACK_WEBHOOK_URL=your-slack-webhook
TEAMS_WEBHOOK_URL=your-teams-webhook
```

### Azure Key Vault Integration

Store sensitive configuration in Azure Key Vault:

```bash
# Create secrets in Key Vault
az keyvault secret set --vault-name cteh-kv-prod --name "jwt-secret" --value "your-jwt-secret"
az keyvault secret set --vault-name cteh-kv-prod --name "openai-api-key" --value "your-openai-key"

# Configure App Service to use Key Vault references
az webapp config appsettings set \
  --resource-group rg-cteh-prod \
  --name cteh-platform-production \
  --settings JWT_SECRET="@Microsoft.KeyVault(VaultName=cteh-kv-prod;SecretName=jwt-secret)"
```

## 🏗️ Infrastructure Setup

### Resource Naming Convention

Follow consistent naming patterns:

```
Resource Group: rg-cteh-{environment}
App Service: cteh-platform-{environment}
Cosmos DB: cteh-cosmos-{environment}
Redis Cache: cteh-redis-{environment}
Storage: ctehstorage{environment}
Key Vault: cteh-kv-{environment}
```

### ARM Template Parameters

Customize the ARM template deployment:

```json
{
  "appName": "cteh-platform",
  "environment": "production",
  "location": "East US",
  "skuName": "S1",
  "cosmosDbAccountName": "cteh-cosmos-prod",
  "redisName": "cteh-redis-prod"
}
```

### Infrastructure Validation

Verify infrastructure deployment:

```bash
# Check resource group
az group show --name rg-cteh-prod

# Check app service
az webapp show --name cteh-platform-production --resource-group rg-cteh-prod

# Check database connection
az cosmosdb show --name cteh-cosmos-prod --resource-group rg-cteh-prod
```

## 📦 Application Deployment

### Build Process

The build process includes:

1. **Backend Build**
   - TypeScript compilation
   - Dependency installation
   - Asset optimization

2. **Frontend Build**
   - React application build
   - Static asset optimization
   - PWA manifest generation

3. **Quality Checks**
   - Linting (ESLint)
   - Type checking (TypeScript)
   - Unit tests (Jest)
   - Security audit (npm audit)

### Deployment Package

The deployment package includes:

```
deployment.zip
├── dist/                 # Compiled backend
├── client/dist/         # Built frontend
├── package.json         # Dependencies
├── package-lock.json    # Locked dependencies
└── web.config          # IIS configuration
```

### App Service Configuration

Configure App Service settings:

```bash
az webapp config appsettings set \
  --resource-group rg-cteh-prod \
  --name cteh-platform-production \
  --settings \
    NODE_ENV=production \
    WEBSITES_PORT=3000 \
    WEBSITES_NODE_DEFAULT_VERSION="~18" \
    WEBSITE_RUN_FROM_PACKAGE=1 \
    WEBSITES_ENABLE_APP_SERVICE_STORAGE=false
```

## ✅ Post-Deployment Verification

### Automated Health Checks

The deployment process includes automated health checks:

1. **Application Health Check**
   ```bash
   curl -f https://cteh-platform-production.azurewebsites.net/health
   ```

2. **API Status Check**
   ```bash
   curl -f https://cteh-platform-production.azurewebsites.net/api/v1/status
   ```

3. **Database Connectivity**
   ```bash
   curl -f https://cteh-platform-production.azurewebsites.net/api/v1/health/database
   ```

### Manual Verification Steps

1. **Application Accessibility**
   - Visit the application URL
   - Verify login functionality
   - Test key features

2. **Performance Check**
   - Monitor page load times
   - Check API response times
   - Verify CDN functionality

3. **Monitoring Setup**
   - Confirm Application Insights data
   - Check log aggregation
   - Verify alerts configuration

## 📊 Monitoring & Maintenance

### Application Insights

Monitor application performance:

- **Performance Metrics**: Response times, throughput, failure rates
- **User Analytics**: User flows, page views, custom events
- **Dependency Tracking**: Database calls, external API calls
- **Exception Tracking**: Errors and stack traces

### Log Analytics

Centralized logging with Azure Monitor:

```bash
# Query application logs
az monitor log-analytics query \
  --workspace cteh-logs-prod \
  --analytics-query "traces | where timestamp > ago(1h) | order by timestamp desc"
```

### Health Monitoring

Set up health check endpoints:

- `/health` - Overall application health
- `/health/database` - Database connectivity
- `/health/redis` - Cache connectivity
- `/health/external` - External service dependencies

### Alerting

Configure alerts for:

- High error rates (>5%)
- Slow response times (>2s)
- Database connection failures
- High memory usage (>80%)
- Certificate expiration

## 🔧 Troubleshooting

### Common Issues

#### 1. Application Won't Start
```bash
# Check application logs
az webapp log tail --name cteh-platform-production --resource-group rg-cteh-prod

# Check configuration
az webapp config appsettings list --name cteh-platform-production --resource-group rg-cteh-prod
```

#### 2. Database Connection Issues
```bash
# Verify connection string
az cosmosdb keys list --name cteh-cosmos-prod --resource-group rg-cteh-prod

# Test connectivity
az webapp ssh --name cteh-platform-production --resource-group rg-cteh-prod
```

#### 3. Performance Issues
```bash
# Check resource utilization
az webapp show --name cteh-platform-production --resource-group rg-cteh-prod --query "siteProperties.usage"

# Scale up if needed
az appservice plan update --name cteh-plan-prod --resource-group rg-cteh-prod --sku P1V2
```

### Debug Mode

Enable debug logging for troubleshooting:

```bash
az webapp config appsettings set \
  --resource-group rg-cteh-prod \
  --name cteh-platform-production \
  --settings LOG_LEVEL=debug
```

### Support Resources

- **Azure Support**: Create support tickets through Azure Portal
- **Application Logs**: Available in Azure Portal > App Service > Logs
- **Metrics Dashboard**: Azure Portal > App Service > Metrics
- **Kudu Console**: `https://cteh-platform-production.scm.azurewebsites.net`

## 🔒 Security Considerations

### Security Best Practices

1. **Environment Variables**
   - Use Azure Key Vault for sensitive data
   - Never commit secrets to version control
   - Rotate secrets regularly

2. **Network Security**
   - Enable HTTPS only
   - Configure proper CORS settings
   - Use private endpoints for databases

3. **Authentication**
   - Implement strong JWT secrets
   - Use secure session configuration
   - Enable account lockout policies

4. **Monitoring**
   - Enable security alerts
   - Monitor for suspicious activities
   - Regular security audits

### Compliance

Ensure compliance with:

- **GDPR**: Data protection and privacy
- **SOC 2**: Security, availability, and confidentiality
- **ISO 27001**: Information security management
- **Industry Standards**: Cognizant security policies

### Security Checklist

- [ ] Secrets stored in Azure Key Vault
- [ ] HTTPS enforced on all endpoints
- [ ] Database firewall configured
- [ ] Application Insights security monitoring enabled
- [ ] Regular security updates applied
- [ ] Backup and disaster recovery tested
- [ ] Access controls properly configured
- [ ] Security headers implemented (Helmet.js)
- [ ] Input validation and sanitization
- [ ] Rate limiting configured

## 📞 Support & Documentation

### Additional Resources

- **Azure Documentation**: https://docs.microsoft.com/en-us/azure/
- **Node.js on Azure**: https://docs.microsoft.com/en-us/azure/app-service/quickstart-nodejs
- **MongoDB on Azure**: https://docs.microsoft.com/en-us/azure/cosmos-db/mongodb/
- **Application Insights**: https://docs.microsoft.com/en-us/azure/azure-monitor/app/nodejs

### Getting Help

1. **Internal Support**: Contact the CTEH development team
2. **Azure Support**: Use Azure Portal support tickets
3. **Community**: Stack Overflow, GitHub Issues
4. **Documentation**: Refer to this deployment guide

---

**Last Updated**: December 2024
**Version**: 1.0.0
**Maintained By**: CTEH Development Team