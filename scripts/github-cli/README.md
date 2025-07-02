# GitHub CLI Setup Scripts

This directory contains scripts to automate the setup of GitHub environments and secrets for the CLKK Backend project.

## Prerequisites

1. **Install GitHub CLI**:
   ```bash
   # macOS
   brew install gh
   
   # Or download from https://cli.github.com/
   ```

2. **Authenticate with GitHub**:
   ```bash
   gh auth login
   ```

## Scripts

### 1. `setup-all.sh`
Master script that runs all setup steps in sequence.

```bash
bash scripts/github-cli/setup-all.sh
```

### 2. `setup-environments.sh`
Creates GitHub environments with protection rules:
- `staging` - No protection rules
- `production` - Requires approval, 5-minute wait timer

```bash
bash scripts/github-cli/setup-environments.sh
```

### 3. `setup-secrets.sh`
Creates repository and environment secrets with placeholder values:
- Repository secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- Production secrets: `PROD_AWS_ACCESS_KEY_ID`, `PROD_AWS_SECRET_ACCESS_KEY`

```bash
bash scripts/github-cli/setup-secrets.sh
```

## Configuration Files

- `config/environments.json` - Environment configuration
- `config/secrets.json` - Secret definitions and placeholders

## Usage

1. **Make scripts executable**:
   ```bash
   chmod +x scripts/github-cli/*.sh
   ```

2. **Run the setup**:
   ```bash
   bash scripts/github-cli/setup-all.sh
   ```

3. **Update placeholder values**:
   - Go to your repository settings
   - Update the secret values with real AWS credentials

## Interactive Mode

When running `setup-secrets.sh` directly, you can enter real values instead of placeholders:
```bash
bash scripts/github-cli/setup-secrets.sh
# You'll be prompted to enter values for each secret
```

## Customization

To add more environments or secrets:
1. Edit the JSON files in `config/`
2. Modify the scripts to read from these configs
3. Run the setup again

## Troubleshooting

- **"gh: command not found"**: Install GitHub CLI
- **"Not authenticated"**: Run `gh auth login`
- **Permission errors**: Make sure you have admin access to the repository
- **API errors**: Check that environments feature is available for your repository