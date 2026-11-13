  return (
    <>
      <Screen>
        {/* Header */}
        <View style={st.header}>
          <View style={st.headerTitle}>
            <Text style={st.title}>{item.caseNumber}</Text>
            <Badge tone={item.status === 'completed' ? 'success' : 'info'}>
              <Text style={st.badgeText}>{item.status.toUpperCase()}</Text>
            </Badge>
          </View>
          <Badge tone={item.urgency === 'high' ? 'danger' : item.urgency === 'medium' ? 'warning' : 'info'}>
            <Text style={st.badgeText}>{item.urgency.toUpperCase()}</Text>
          </Badge>
        </View>

        {/* Actions row */}
        <View style={st.headerActions}>
          <Button
            title="View case"
            onPress={() => router.push(`/(app)/case/[id]` as any)}
          />
        </View>

        {/* Machine info */}
        <SectionHeader title="Machine" />
        <View style={st.machineRow}>
          <Text style={st.machineLabel}>Machine ID</Text>
          <Text style={st.machineValue}>{item.machine?.machineId || 'CMP-001'}</Text>
        </View>
        <View style={st.machineRow}>
          <Text style={st.machineLabel}>Machine name</Text>
          <Text style={st.machineValue}>{item.machine?.name || 'HICON HZB-160F'}</Text>
        </View>

        {/* Case details */}
        <SectionHeader title="Case details" />
        <KeyValue label="Problem" value={item.currentProblem} />
        <KeyValue label="Reported" value={fmtDateTime(item.dateReported)} />
        <KeyValue label="Reported by" value={item.reportedBy?.name || 'Unknown'} />
        <KeyValue label="Urgency" value={item.urgency} />
        <KeyValue label="Status" value={item.status} />
        <KeyValue label="Linked record" value={item.linkedMaintenanceRecord ? 'Maintenance record' : 'None'} />

        {/* Analysis / Suggestion */}
        {item.analysis.suggestions.length > 0 ? (
          <SectionHeader title="Best suggestion" />
          <Card tone="primary">
            <View style={st.suggestionHead}>
              <Text style={st.suggestionTitle}>{item.analysis.suggestions[0].title}</Text>
              <Text style={st.suggestionConfidence}>{item.analysis.suggestions[0].confidence}%</Text>
            </View>
            <Muted>{item.analysis.suggestions[0].rationale}</Muted>
            <KeyValue label="Recommended action" value={item.analysis.suggestions[0].recommendedAction} />
            {item.analysis.suggestions[0].parts.length > 0 ? (
              <View style={st.partsList}>
                {item.analysis.suggestions[0].parts.map((part, idx) => (
                  <View key={idx} style={st.partChip}>
                    <Text style={st.partText}>{part}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {item.analysis.suggestions[0].evidence && item.analysis.suggestions[0].evidence.length > 0 ? (
              <Muted>
                {item.analysis.suggestions[0].evidence.map((ev, idx) => (
                  <Text key={idx}>• {ev}</Text>
                ))}
              </Muted>
            ) : null}
          </Card>
        ) : (
          <Card>
            <Text style={st.noData}>No suggestion available — add more maintenance, failure, or completed-case records then re-run the analysis.</Text>
          </Card>
        )}

        {/* Review note (if any) */}
        {item.review.reviewerNote ? (
          <SectionHeader title="Reviewer note" />
          <Card tone="info">
            <Text style={st.noteText}>{item.review.reviewerNote}</Text>
          </Card>
        ) : null}

        {/* Delete action */}
        <SectionHeader title="Actions" />
        <Card>
          <IconAction
            icon="trash-outline"
            label="Delete case"
            tone="danger"
            onPress={askDelete}
          />
        </Card>

        {/* Confirmation dialog for delete */}
        {confirmingDelete ? (
          <Notice tone="danger" title="Delete this maintenance case?">
            <Text style={st.confirmText}>
              This will soft-delete case {item.caseNumber} (status will be{' '}
              <Text style={st.confirmBold}>deleted</Text>, but the record and its data
              will remain for audit traceability).
            </Text>
            <View style={st.confirmActions}>
              <Button title="Cancel" onPress={() => setConfirmingDelete(false)} />
              <Button
                title="Confirm delete"
                variant="danger"
                onPress={confirmDelete}
                disabled={deletingId === item._id}
              />
            </View>
          </Notice>
        ) : null}
      </Screen>
    </>
  );
}