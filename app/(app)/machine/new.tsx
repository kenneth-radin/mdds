import React, { useState } from 'react';
import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Field, Muted, Notice, Screen, Subtitle, Title } from '../../../components/ui';
import { api, errorMessage } from '../../../lib/api';
import { isValidDateInput, toIsoOrNull } from '../../../lib/format';

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
        operatingHours: form.operatingHours ? Number(form.operatingHours) : 0,
        ratedPowerKw: form.ratedPowerKw ? Number(form.ratedPowerKw) : null,
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
      <Title>Add Machine</Title>
      <Subtitle>Register a real machine profile. Only entered values are stored.</Subtitle>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Card>
        <Field label="Machine ID *" value={form.machineId} onChangeText={set('machineId')} placeholder="MX-001" />
        <Field label="Machine name *" value={form.name} onChangeText={set('name')} placeholder="Dough Mixer" />
        <Field label="Machine type *" value={form.machineType} onChangeText={set('machineType')} placeholder="Mixer / Pump / Conveyor" />
        <Field label="Manufacturer" value={form.manufacturer} onChangeText={set('manufacturer')} />
        <Field label="Model" value={form.model} onChangeText={set('model')} />
        <Field label="Serial number" value={form.serialNumber} onChangeText={set('serialNumber')} />
        <Field label="Location" value={form.location} onChangeText={set('location')} placeholder="Production line 1" />
        <Field label="Installation date (YYYY-MM-DD)" value={form.installationDate} onChangeText={set('installationDate')} placeholder="2024-01-15" />
        <Field label="Operating hours" value={form.operatingHours} onChangeText={set('operatingHours')} keyboardType="numeric" placeholder="0" />
        <Field label="Rated power (kW)" value={form.ratedPowerKw} onChangeText={set('ratedPowerKw')} keyboardType="numeric" placeholder="Optional" />
        <Field label="Notes" value={form.notes} onChangeText={set('notes')} placeholder="Optional" />
      </Card>
      <Card>
        <Muted>Criticality</Muted>
        <Pressable onPress={() => setCriticality('low')}><Title>{criticality === 'low' ? '◉' : '○'} Low</Title></Pressable>
        <Pressable onPress={() => setCriticality('medium')}><Title>{criticality === 'medium' ? '◉' : '○'} Medium</Title></Pressable>
        <Pressable onPress={() => setCriticality('high')}><Title>{criticality === 'high' ? '◉' : '○'} High</Title></Pressable>
      </Card>
      <Button title={busy ? 'Saving…' : 'Save machine'} onPress={submit} disabled={busy} />
    </Screen>
  );
}
