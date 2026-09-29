import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Button,
  Card,
  ChoiceGroup,
  Field,
  Notice,
  Screen,
  ScreenHeader,
  SectionHeader
} from '../../../components/ui';
import { api, errorMessage } from '../../../lib/api';
import { isValidDateInput, isValidNumberInput, toIsoOrNull, toNumberOrNull } from '../../../lib/format';

export default function NewMachineScreen() {
  const router = useRouter();
  const [form, setForm] = useState({
    machineId: '',
    name: '',
    machineType: '',
    manufacturer: '',
    model: '',
    serialNumber: '',
    location: '',
    installationDate: '',
    operatingHours: '',
    ratedPowerKw: '',
    notes: ''
  });
  const [criticality, setCriticality] = useState<'low' | 'medium' | 'high'>('medium');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    const missing = [
      ['Machine ID', form.machineId],
      ['Machine name', form.name],
      ['Machine type', form.machineType]
    ]
      .filter(([, value]) => !value.trim())
      .map(([label]) => label);

    if (missing.length > 0) {
      setError(`Please fill in: ${missing.join(', ')}.`);
      return;
    }
    if (form.installationDate.trim() && !isValidDateInput(form.installationDate)) {
      setError('Installation date must look like 2024-01-15.');
      return;
    }
    if (!isValidNumberInput(form.operatingHours)) {
      setError('Operating hours must be a number.');
      return;
    }
    if (!isValidNumberInput(form.ratedPowerKw)) {
      setError('Rated power (kW) must be a number.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await api.post<{ machine: { _id: string } }>('/api/machines', {
        machineId: form.machineId.trim(),
        name: form.name.trim(),
        machineType: form.machineType.trim(),
        manufacturer: form.manufacturer.trim(),
        model: form.model.trim(),
        serialNumber: form.serialNumber.trim(),
        location: form.location.trim(),
        criticality,
        installationDate: toIsoOrNull(form.installationDate),
        operatingHours: toNumberOrNull(form.operatingHours) ?? 0,
        ratedPowerKw: toNumberOrNull(form.ratedPowerKw),
        notes: form.notes.trim()
      });
      router.replace(`/(app)/machine/${result.machine._id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader
        title="Add a machine"
        subtitle="Register a real machine profile. Only the values you enter are stored."
      />

      {error ? (
        <Notice tone="danger" title="Could not save the machine">
          {error}
        </Notice>
      ) : null}

      <Card>
        <SectionHeader
          title="Identity"
          icon="construct-outline"
          subtitle="How this asset is identified on the shop floor"
        />
        <Field
          label="Machine ID"
          value={form.machineId}
          onChangeText={set('machineId')}
          placeholder="MX-001"
          required
        />
        <Field
          label="Machine name"
          value={form.name}
          onChangeText={set('name')}
          placeholder="Dough Mixer"
          required
        />
        <Field
          label="Machine type"
          value={form.machineType}
          onChangeText={set('machineType')}
          placeholder="Mixer / Pump / Conveyor"
          required
        />
        <Field
          label="Manufacturer"
          value={form.manufacturer}
          onChangeText={set('manufacturer')}
          placeholder="Optional"
        />
        <Field label="Model" value={form.model} onChangeText={set('model')} placeholder="Optional" />
        <Field
          label="Serial number"
          value={form.serialNumber}
          onChangeText={set('serialNumber')}
          placeholder="Optional"
        />
        <Field
          label="Location"
          value={form.location}
          onChangeText={set('location')}
          placeholder="Production line 1"
        />
      </Card>

      <Card>
        <SectionHeader
          title="Service and ratings"
          icon="speedometer-outline"
          subtitle="Optional figures used by the dashboards"
        />
        <Field
          label="Installation date (YYYY-MM-DD)"
          value={form.installationDate}
          onChangeText={set('installationDate')}
          placeholder="2024-01-15"
          helper="Leave blank if the date is unknown."
        />
        <Field
          label="Operating hours"
          value={form.operatingHours}
          onChangeText={set('operatingHours')}
          keyboardType="numeric"
          placeholder="0"
        />
        <Field
          label="Rated power (kW)"
          value={form.ratedPowerKw}
          onChangeText={set('ratedPowerKw')}
          keyboardType="numeric"
          placeholder="Optional"
        />
        <Field
          label="Notes"
          value={form.notes}
          onChangeText={set('notes')}
          placeholder="Optional"
          multiline
        />
      </Card>

      <Card tone="muted">
        <ChoiceGroup
          label="Criticality"
          value={criticality}
          options={[
            { value: 'low', label: 'Low', hint: 'Failure only slows a non-critical step' },
            { value: 'medium', label: 'Medium', hint: 'Failure reduces throughput' },
            { value: 'high', label: 'High', hint: 'Failure stops the line' }
          ]}
          onChange={(value) => setCriticality(value)}
        />
      </Card>

      <Button title="Save machine" icon="checkmark-outline" loading={busy} onPress={submit} />
    </Screen>
  );
}
