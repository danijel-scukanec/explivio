@description('The location for the resource(s) to be deployed.')
param location string = resourceGroup().location

param sql_outputs_name string

param sql_outputs_sqlserveradminname string

param principalId string

param principalName string

param principalType string

resource sql 'Microsoft.Sql/servers@2023-08-01' existing = {
  name: sql_outputs_name
}

resource sqlServerAdmin 'Microsoft.ManagedIdentity/userAssignedIdentities@2024-11-30' existing = {
  name: sql_outputs_sqlserveradminname
}

resource mi 'Microsoft.ManagedIdentity/userAssignedIdentities@2024-11-30' existing = {
  name: principalName
}

resource script_sql_sqlserver 'Microsoft.Resources/deploymentScripts@2023-08-01' = {
  name: take('script-${uniqueString('sql', principalName, 'sqlserver', resourceGroup().id)}', 24)
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${sqlServerAdmin.id}': { }
    }
  }
  kind: 'AzurePowerShell'
  properties: {
    azPowerShellVersion: '14.0'
    retentionInterval: 'PT1H'
    environmentVariables: [
      {
        name: 'DBNAME'
        value: 'Explivio'
      }
      {
        name: 'DBSERVER'
        value: sql.properties.fullyQualifiedDomainName
      }
      {
        name: 'PRINCIPALTYPE'
        value: principalType
      }
      {
        name: 'PRINCIPALNAME'
        value: principalName
      }
      {
        name: 'ID'
        value: mi.properties.clientId
      }
    ]
    scriptContent: '\$sqlServerFqdn = "\$env:DBSERVER"\r\n\$sqlDatabaseName = "\$env:DBNAME"\r\n\$principalName = "\$env:PRINCIPALNAME"\r\n\$id = "\$env:ID"\r\n\r\n# Pin SqlServer to the 21.x line. 22.x Invoke-Sqlcmd unconditionally registers the Azure Key Vault\r\n# (Always-Encrypted) column-encryption provider, which crashes in the Az PowerShell 14 image with\r\n# MissingMethodException on Microsoft.Extensions.Caching.Memory.MemoryCache..ctor (assembly conflict).\r\n# 21.x predates that auto-registration, so the broken path never runs. (azd infra gen pins 22.3.0,\r\n# which is still affected - see https://github.com/microsoft/aspire/issues/9926)\r\nInstall-Module -Name SqlServer -RequiredVersion 21.1.18256 -Force -AllowClobber -Scope CurrentUser\r\nImport-Module SqlServer\r\n\r\n\$sqlCmd = @"\r\nDECLARE @name SYSNAME = \'\$principalName\';\r\nDECLARE @id UNIQUEIDENTIFIER = \'\$id\';\r\n\r\n-- Convert the guid to the right type\r\nDECLARE @castId NVARCHAR(MAX) = CONVERT(VARCHAR(MAX), CONVERT (VARBINARY(16), @id), 1);\r\n\r\n-- Construct command: CREATE USER [@name] WITH SID = @castId, TYPE = E;\r\nDECLARE @cmd NVARCHAR(MAX) = N\'CREATE USER [\' + @name + \'] WITH SID = \' + @castId + \', TYPE = E;\'\r\nEXEC (@cmd);\r\n\r\n-- Assign roles to the new user\r\nDECLARE @role1 NVARCHAR(MAX) = N\'ALTER ROLE db_owner ADD MEMBER [\' + @name + \']\';\r\nEXEC (@role1);\r\n\r\n"@\r\n# Note: the string terminator must not have whitespace before it, therefore it is not indented.\r\n\r\nWrite-Host \$sqlCmd\r\n\r\n\$token = [System.Net.NetworkCredential]::new(\'\', (Get-AzAccessToken -ResourceUrl "https://database.windows.net/" -AsSecureString).Token).Password\r\n\r\n\$maxRetries = 5\r\n\$retryDelay = 60\r\n\$attempt = 0\r\n\$success = \$false\r\n\r\nwhile (-not \$success -and \$attempt -lt \$maxRetries) {\r\n    \$attempt++\r\n    Write-Host "Attempt \$attempt of \$maxRetries..."\r\n    try {\r\n        Invoke-Sqlcmd -ServerInstance \$sqlServerFqdn -Database \$sqlDatabaseName -AccessToken \$token -Query \$sqlCmd -EncryptConnection\r\n        \$success = \$true\r\n        Write-Host "SQL command succeeded on attempt \$attempt."\r\n    } catch {\r\n        Write-Host "Attempt \$attempt failed: \$_"\r\n        if (\$attempt -lt \$maxRetries) {\r\n            Write-Host "Retrying in \$retryDelay seconds..."\r\n            Start-Sleep -Seconds \$retryDelay\r\n        } else {\r\n            throw\r\n        }\r\n    }\r\n}'
  }
}