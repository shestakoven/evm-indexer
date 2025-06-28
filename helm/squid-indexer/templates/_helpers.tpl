{{/*
Expand the name of the chart.
*/}}
{{- define "squid-indexer.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "squid-indexer.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "squid-indexer.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "squid-indexer.labels" -}}
helm.sh/chart: {{ include "squid-indexer.chart" . }}
{{ include "squid-indexer.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "squid-indexer.selectorLabels" -}}
app.kubernetes.io/name: {{ include "squid-indexer.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "squid-indexer.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "squid-indexer.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Environment variables for the application
*/}}
{{- define "squid-indexer.env" -}}
- name: CLICKHOUSE_PASSWORD
  valueFrom:
    secretKeyRef:
      name: {{ include "squid-indexer.fullname" . }}-secret
      key: CLICKHOUSE_PASSWORD
{{- range $key, $value := .Values.config }}
{{- if ne $key "clickhousePassword" }}
- name: {{ $key | upper | replace "." "_" }}
  valueFrom:
    configMapKeyRef:
      name: {{ include "squid-indexer.fullname" $ }}-config
      key: {{ $key | upper | replace "." "_" }}
{{- end }}
{{- end }}
{{- end }} 