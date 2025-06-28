# Squid Indexer Helm Chart

This Helm chart deploys the Squid EVM Indexer on Kubernetes.

## Prerequisites

- Kubernetes 1.19+
- Helm 3.8+
- ClickHouse (either deployed via this chart or external)

## Installation

### Add Bitnami Repository (for ClickHouse dependency)

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
```

### Install with Default Values

```bash
helm install squid-indexer ./helm/squid-indexer
```

### Install with Custom Values

```bash
helm install squid-indexer ./helm/squid-indexer \
  --set config.gatewayUrl="https://v2.archive.subsquid.io/network/ethereum-mainnet" \
  --set config.rpcEthHttp="https://rpc.ankr.com/eth" \
  --set clickhouse.auth.password="your-secure-password"
```

### Install for Development

```bash
helm install squid-indexer-dev ./helm/squid-indexer \
  -f ./helm/squid-indexer/values-dev.yaml \
  --namespace squid-indexer-dev \
  --create-namespace
```

### Install for Production

```bash
helm install squid-indexer-prod ./helm/squid-indexer \
  -f ./helm/squid-indexer/values-prod.yaml \
  --namespace squid-indexer-prod \
  --create-namespace \
  --set externalClickhouse.password="your-prod-password"
```

## Configuration

### Required Values

The following values must be configured:

```yaml
config:
  gatewayUrl: "https://v2.archive.subsquid.io/network/ethereum-mainnet"
  rpcEthHttp: "https://rpc.ankr.com/eth"

# If using embedded ClickHouse
clickhouse:
  auth:
    password: "secure-password"

# If using external ClickHouse
externalClickhouse:
  host: "clickhouse.example.com"
  password: "secure-password"
```

### Storage Configuration

Control what data to store:

```yaml
config:
  storeBlocks: false          # Store full block data
  storeTransactions: false    # Store transaction data
  storeLogs: false           # Store raw log data
  storeTransfers: true       # Store token transfers (recommended)
  storeNativeBalances: false # Store ETH balance changes
  storeBalanceIncreases: true # Store balance increases (required for views)
  storeBalanceDecreases: true # Store balance decreases (required for views)
```

### Performance Tuning

```yaml
config:
  batchSize: 100                    # Records per batch
  balanceChangesTtlDays: 90        # TTL for balance changes
  clickhouseTimeout: 30000         # Request timeout (ms)
  clickhouseMaxRetries: 3          # Max retry attempts

resources:
  limits:
    cpu: 2000m
    memory: 2Gi
  requests:
    cpu: 1000m
    memory: 1Gi

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
```

### Ingress Configuration

```yaml
ingress:
  enabled: true
  className: "nginx"
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
  hosts:
    - host: squid-indexer.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: squid-indexer-tls
      hosts:
        - squid-indexer.example.com
```

## ClickHouse Options

### Embedded ClickHouse

Use the bundled ClickHouse for development/testing:

```yaml
clickhouse:
  enabled: true
  auth:
    username: default
    password: "secure-password"
    database: base
  persistence:
    enabled: true
    size: 20Gi
  resources:
    limits:
      cpu: 2000m
      memory: 4Gi
```

### External ClickHouse

Use an external ClickHouse instance for production:

```yaml
clickhouse:
  enabled: false

externalClickhouse:
  host: "clickhouse-prod.example.com"
  port: 8123
  username: "squid_user"
  password: "secure-password"
  database: "squid_db"
```

## Monitoring

Enable Prometheus monitoring:

```yaml
monitoring:
  enabled: true
  serviceMonitor:
    enabled: true
    interval: 30s
    scrapeTimeout: 10s
```

## Security

The chart includes security best practices:

- Non-root user execution
- Read-only root filesystem
- Dropped capabilities
- Security contexts
- Network policies (optional)

## Upgrading

```bash
# Upgrade with new values
helm upgrade squid-indexer ./helm/squid-indexer \
  --reuse-values \
  --set image.tag="v1.1.0"

# Upgrade with new values file
helm upgrade squid-indexer ./helm/squid-indexer \
  -f ./helm/squid-indexer/values-prod.yaml
```

## Rollback

```bash
# Rollback to previous version
helm rollback squid-indexer

# Rollback to specific revision
helm rollback squid-indexer 2
```

## Uninstalling

```bash
helm uninstall squid-indexer
```

## Troubleshooting

### Check Pod Status

```bash
kubectl get pods -l app.kubernetes.io/name=squid-indexer
```

### View Logs

```bash
kubectl logs -l app.kubernetes.io/name=squid-indexer -f
```

### Check ClickHouse Connection

```bash
kubectl exec -it deployment/squid-indexer -- npm run migrate
```

### Debug Configuration

```bash
kubectl describe configmap squid-indexer-config
kubectl describe secret squid-indexer-secret
```

## Values Reference

| Parameter | Description | Default |
|-----------|-------------|---------|
| `replicaCount` | Number of replicas | `1` |
| `image.repository` | Image repository | `squid-indexer` |
| `image.tag` | Image tag | `latest` |
| `config.gatewayUrl` | Subsquid gateway URL | Required |
| `config.rpcEthHttp` | Ethereum RPC endpoint | Required |
| `config.batchSize` | Batch size for processing | `100` |
| `clickhouse.enabled` | Enable embedded ClickHouse | `true` |
| `autoscaling.enabled` | Enable HPA | `false` |
| `ingress.enabled` | Enable ingress | `false` |
| `monitoring.enabled` | Enable monitoring | `false` |

For a complete list of values, see [values.yaml](./values.yaml). 