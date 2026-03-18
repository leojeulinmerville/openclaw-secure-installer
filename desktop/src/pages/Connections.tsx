import { useEffect, useMemo, useState } from 'react';
import { FlaskConical, Link2, Loader2, RefreshCcw, ShieldAlert, LogOut, Phone } from 'lucide-react';
import { useDesktop } from '../contexts/DesktopContext';
import {
  connectionsConfigure,
  connectionsGetSchema,
  connectionsGetStatus,
  connectionsTest,
  openConsoleWindow,
  whatsappLogout,
} from '../lib/tauri';
import { WhatsAppLogin } from '../components/WhatsAppLogin';
import type {
  ChannelConnectionSchemaItem,
  ConnectionKind,
  ConnectionOperationResult,
  ConnectionSchemaField,
  ConnectionStatusItem,
  ConnectionsSchemaResponse,
  ConnectionsStatusResponse,
  ProviderConnectionSchemaItem,
} from '../types';

const EMPTY_SCHEMA: ConnectionsSchemaResponse = {
  version: 'v1',
  generated_at: '',
  safe_mode: true,
  channels: [],
  providers: [],
};

const EMPTY_STATUS: ConnectionsStatusResponse = {
  version: 'v1',
  generated_at: '',
  safe_mode: true,
  channels: [],
  providers: [],
};

type SelectedConnection = {
  kind: ConnectionKind;
  id: string;
};

export function Connections() {
  const { isGatewayReady, startGateway } = useDesktop();
  const [schema, setSchema] = useState<ConnectionsSchemaResponse>(EMPTY_SCHEMA);
  const [status, setStatus] = useState<ConnectionsStatusResponse>(EMPTY_STATUS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedConnection | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [showWhatsAppLogin, setShowWhatsAppLogin] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [schemaPayload, statusPayload] = await Promise.all([
        connectionsGetSchema(),
        connectionsGetStatus(),
      ]);
      setSchema(schemaPayload);
      setStatus(statusPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSchema(EMPTY_SCHEMA);
      setStatus(EMPTY_STATUS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isGatewayReady) {
      return;
    }
    void load();
  }, [isGatewayReady]);

  const selectedDescriptor = useMemo(() => {
    if (!selected) {
      return null;
    }
    if (selected.kind === 'channel') {
      return schema.channels.find((entry) => entry.id === selected.id) ?? null;
    }
    return schema.providers.find((entry) => entry.id === selected.id) ?? null;
  }, [schema.channels, schema.providers, selected]);

  const selectedStatus = useMemo(() => {
    if (!selected) {
      return null;
    }
    if (selected.kind === 'channel') {
      return status.channels.find((entry) => entry.id === selected.id) ?? null;
    }
    return status.providers.find((entry) => entry.id === selected.id) ?? null;
  }, [selected, status.channels, status.providers]);

  const onSelectConnection = (kind: ConnectionKind, id: string) => {
    setSelected({ kind, id });
    setResultMessage(null);
    setFormValues({});
  };

  const updateFormValue = (key: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const buildPayloadFromForm = (fields: ConnectionSchemaField[]) => {
    const payload: Record<string, unknown> = {};
    for (const field of fields) {
      const raw = formValues[field.key] ?? '';
      const trimmed = raw.trim();
      if (!trimmed) {
        continue;
      }
      if (field.type === 'boolean') {
        payload[field.key] = trimmed === 'true';
        continue;
      }
      if (field.type === 'number') {
        const parsed = Number(trimmed);
        if (Number.isFinite(parsed)) {
          payload[field.key] = parsed;
        }
        continue;
      }
      payload[field.key] = raw;
    }
    return payload;
  };

  const handleConfigureSelected = async () => {
    if (!selected || !selectedDescriptor) {
      return;
    }
    setSaving(true);
    setError(null);
    setResultMessage(null);
    try {
      const values = buildPayloadFromForm(selectedDescriptor.schema.fields);
      const result = await connectionsConfigure(selected.kind, selected.id, values);
      setResultMessage(result.message || 'Configuration saved.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async (
    kind: ConnectionKind,
    id: string,
    fields: ConnectionSchemaField[],
  ) => {
    setTesting(true);
    setError(null);
    setResultMessage(null);
    try {
      const values = selected?.kind === kind && selected?.id === id
        ? buildPayloadFromForm(fields)
        : {};
      const result = await connectionsTest(kind, id, values);
      setResultMessage(formatTestMessage(result));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTesting(false);
    }
  };

  const handlePair = async (id: string) => {
    if (id === 'whatsapp') {
      setShowWhatsAppLogin(true);
      return;
    }
    try {
      await openConsoleWindow();
      setResultMessage('Opened OpenClaw Console for pairing flow.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleLogout = async (_kind: ConnectionKind, id: string) => {
    if (id === 'whatsapp') {
      try {
        await whatsappLogout();
        setResultMessage('Logged out from WhatsApp.');
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
  };

  if (!isGatewayReady) {
    return (
      <div className="h-full p-6 space-y-5">
        <div className="glass-panel p-6 space-y-3">
          <h2 className="text-xl font-bold text-white">Connections</h2>
          <p className="text-sm text-white/60">
            Start the gateway first to load runtime connection schemas.
          </p>
          <button
            onClick={() => void startGateway().then(load)}
            className="glass-button-accent inline-flex items-center gap-2"
          >
            <RefreshCcw className="w-4 h-4" />
            Start Gateway
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full p-5 space-y-4">
      {showWhatsAppLogin && (
        <WhatsAppLogin 
          onClose={() => setShowWhatsAppLogin(false)} 
          onSuccess={() => {
            setShowWhatsAppLogin(false);
            load();
          }}
        />
      )}
      <div className="glass-panel p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Connections</h2>
            <p className="text-xs text-white/50">
              Runtime-driven setup for channels and providers.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => void load()} className="glass-button text-sm">
              <RefreshCcw className="w-4 h-4" />
            </button>
            <button onClick={() => void openConsoleWindow()} className="glass-button text-sm">
              <Link2 className="w-4 h-4" />
              Open Console
            </button>
          </div>
        </div>
        <div className="bg-white/5 rounded-lg p-3 text-xs text-white/70 border border-white/10 space-y-2">
          <p><strong>🌐 Desktop-Direct:</strong> These connections are fully integrated into the Desktop UI for no-code setup and testing.</p>
          <p><strong>🛠️ Gateway-Native:</strong> Advanced plugins and extensions are configured through the OpenClaw Console or config files. Some features may only be partially visible here.</p>
          <p><strong>🔒 Safe Mode:</strong> When active, network tests for cloud providers may be blocked. Use local providers (Ollama) for fully offline operation.</p>
        </div>
      </div>

      {schema.safe_mode && (
        <div className="bg-amber-500/10 border border-amber-500/25 text-amber-100 text-xs rounded-xl px-3 py-2 inline-flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" />
          Safe Mode is active. Network tests can be blocked when allow_internet is disabled.
        </div>
      )}

      {loading ? (
        <div className="glass-panel p-8 flex items-center justify-center text-white/60">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading runtime connections...
        </div>
      ) : (
        <div className="grid xl:grid-cols-2 gap-4">
          <ConnectionGroup
            title={`Channels (${schema.channels.length})`}
            items={schema.channels}
            statuses={status.channels}
            onSetup={(id) => onSelectConnection('channel', id)}
            onTest={(id, fields) => void handleTestConnection('channel', id, fields)}
            onPair={(id) => void handlePair(id)}
            onLogout={(id) => void handleLogout('channel', id)}
            testing={testing}
          />
          <ConnectionGroup
            title={`Providers (${schema.providers.length})`}
            items={schema.providers}
            statuses={status.providers}
            onSetup={(id) => onSelectConnection('provider', id)}
            onTest={(id, fields) => void handleTestConnection('provider', id, fields)}
            onPair={(id) => void handlePair(id)}
            onLogout={(id) => void handleLogout('provider', id)}
            testing={testing}
          />
        </div>
      )}

      {selectedDescriptor && selected && (
        <div className="glass-panel p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-white">
              Setup {selectedDescriptor.display_name}
            </h3>
            {selectedStatus && <StatusBadge item={selectedStatus} />}
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {selectedDescriptor.schema.fields.length === 0 ? (
              <p className="text-xs text-white/50">
                No setup fields exposed for this connection yet. Use OpenClaw Console for advanced setup.
              </p>
            ) : (
              selectedDescriptor.schema.fields.map((field) => (
                <FieldEditor
                  key={field.key}
                  field={field}
                  value={formValues[field.key] ?? ''}
                  onChange={(next) => updateFormValue(field.key, next)}
                />
              ))
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void handleConfigureSelected()}
              disabled={saving}
              className={`text-sm ${saving ? 'glass-button opacity-70 cursor-not-allowed' : 'glass-button-accent'}`}
            >
              <Link2 className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Setup'}
            </button>
            <button
              onClick={() => void handleTestConnection(selected.kind, selected.id, selectedDescriptor.schema.fields)}
              disabled={testing || !supportsTesting(selectedDescriptor)}
              className={`text-sm ${(testing || !supportsTesting(selectedDescriptor)) ? 'glass-button opacity-70 cursor-not-allowed' : 'glass-button'}`}
            >
              <FlaskConical className="w-4 h-4" />
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
            {isChannelDescriptor(selectedDescriptor) &&
              selectedDescriptor.requires_pairing &&
              selectedDescriptor.test_capabilities.pairing_supported && (
                <button onClick={() => void handlePair(selected.id)} className="glass-button text-sm">
                  Pair In Console
                </button>
              )}
          </div>
        </div>
      )}

      {resultMessage && (
        <div className="glass-panel p-3 text-xs text-emerald-200 border border-emerald-500/30 bg-emerald-500/10">
          {resultMessage}
        </div>
      )}
      {error && (
        <div className="glass-panel p-3 text-xs text-red-200 border border-red-500/30 bg-red-500/10">
          {error}
        </div>
      )}
    </div>
  );
}

function supportsTesting(item: ChannelConnectionSchemaItem | ProviderConnectionSchemaItem): boolean {
  return item.test_capabilities.can_test;
}

function isChannelDescriptor(
  item: ChannelConnectionSchemaItem | ProviderConnectionSchemaItem,
): item is ChannelConnectionSchemaItem {
  return typeof (item as ChannelConnectionSchemaItem).requires_pairing === 'boolean';
}

function formatTestMessage(result: ConnectionOperationResult): string {
  const headline = result.message?.trim() || (result.ok ? 'Connection test succeeded.' : 'Connection test failed.');
  return result.ok ? `Success: ${headline}` : `Test result: ${headline}`;
}

function ConnectionGroup(props: {
  title: string;
  items: Array<ChannelConnectionSchemaItem | ProviderConnectionSchemaItem>;
  statuses: ConnectionStatusItem[];
  onSetup: (id: string) => void;
  onTest: (id: string, fields: ConnectionSchemaField[]) => void;
  onPair: (id: string) => void;
  onLogout: (id: string) => void;
  testing: boolean;
}) {
  return (
    <div className="glass-panel p-3 space-y-3">
      <h3 className="text-xs font-semibold text-white/80">{props.title}</h3>
      <div className="space-y-2">
        {props.items.map((item) => {
          const status = props.statuses.find((entry) => entry.id === item.id);
          const canTest = supportsTesting(item);
          const requiresPairing = isChannelDescriptor(item) ? item.requires_pairing : false;
          const pairingSupported =
            item.test_capabilities.pairing_supported === true && requiresPairing;
          
          // WhatsApp specific metadata from status
          const waAccount = item.id === 'whatsapp' ? (status as any)?.accounts?.default : null;
          const linkedNumber = waAccount?.self?.e164;

          return (
            <div key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-white">{item.display_name}</p>
                  {status && <StatusBadge item={status} />}
                </div>
                {linkedNumber && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-mono">
                    <Phone className="w-3 h-3" />
                    +{linkedNumber}
                  </div>
                )}
              </div>
              <p className="text-xs text-white/50">
                {canTest
                  ? item.test_capabilities.blocked_by_policy
                    ? 'Test blocked by policy while Safe Mode internet is disabled.'
                    : 'Desktop-Direct: Basic setup and testing available.'
                  : 'Gateway-Native: Requires configuration via OpenClaw Console.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => props.onSetup(item.id)} className="glass-button text-xs">
                  {canTest ? 'Setup' : 'View Config'}
                </button>
                <button
                  onClick={() => props.onTest(item.id, item.schema.fields)}
                  disabled={!canTest || props.testing}
                  className={`text-xs ${(!canTest || props.testing) ? 'glass-button opacity-70 cursor-not-allowed' : 'glass-button'}`}
                >
                  Test
                </button>
                {item.id !== 'whatsapp' && (
                  <button 
                    onClick={() => props.onPair(item.id)} 
                    className="glass-button text-xs text-cyan-400 hover:bg-cyan-500/10"
                    title="Open advanced configuration in Gateway Console"
                  >
                    <Link2 className="w-3 h-3 mr-1" />
                    Console
                  </button>
                )}
                {pairingSupported && item.id === 'whatsapp' && !waAccount?.linked && (
                  <button onClick={() => props.onPair(item.id)} className="glass-button-accent text-xs">
                    Pair
                  </button>
                )}
                {waAccount?.linked && (
                  <button onClick={() => props.onLogout(item.id)} className="glass-button text-xs text-red-400 hover:bg-red-500/10">
                    <LogOut className="w-3 h-3 mr-1" />
                    Logout
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {props.items.length === 0 && (
          <p className="text-xs text-white/40">No runtime-discovered entries.</p>
        )}
      </div>
    </div>
  );
}

function FieldEditor(props: {
  field: ConnectionSchemaField;
  value: string;
  onChange: (value: string) => void;
}) {
  const { field, value, onChange } = props;
  const requiredLabel = field.required ? 'required' : 'optional';
  return (
    <label className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-xs text-white/80">{field.display_name}</span>
        <span className="text-[10px] uppercase text-white/40">{requiredLabel}</span>
        {field.storage && (
          <span className="text-[10px] uppercase text-cyan-200/70">{field.storage}</span>
        )}
      </div>
      {field.type === 'enum' ? (
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full glass-input text-sm"
        >
          <option value="">Select...</option>
          {(field.enum ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : field.type === 'boolean' ? (
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full glass-input text-sm"
        >
          <option value="">Select...</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : (
        <input
          type={field.type === 'secret' ? 'password' : field.type === 'number' ? 'number' : 'text'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.key}
          className="w-full glass-input text-sm"
        />
      )}
      {field.help_text && <p className="text-[11px] text-white/45">{field.help_text}</p>}
    </label>
  );
}

function StatusBadge(props: { item: ConnectionStatusItem }) {
  const { item } = props;
  const tone = item.healthy
    ? 'text-emerald-200 border-emerald-500/35 bg-emerald-500/15'
    : item.configured
      ? 'text-amber-200 border-amber-500/35 bg-amber-500/15'
      : 'text-white/60 border-white/20 bg-white/10';
  const label = item.healthy
    ? 'Healthy'
    : item.configured
      ? 'Configured'
      : 'Not configured';
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${tone}`}>
      {label}
    </span>
  );
}
