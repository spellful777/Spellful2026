import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Shield, Eye, MessageCircle, Users, Bell, Mic } from 'lucide-react';

interface PrivacySettings {
  whoCanMessage: string;
  presenceVisibility: string;
  showTypingIndicators: boolean;
  showReadReceipts: boolean;
  groupInvitePermission: string;
  allowVoiceMessages: boolean;
  notificationPreview: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const DEFAULTS: PrivacySettings = {
  whoCanMessage: 'everyone',
  presenceVisibility: 'everyone',
  showTypingIndicators: true,
  showReadReceipts: true,
  groupInvitePermission: 'everyone',
  allowVoiceMessages: true,
  notificationPreview: true,
};

function SelectRow({
  label,
  description,
  icon: Icon,
  value,
  options,
  onChange,
}: {
  label: string;
  description: string;
  icon: React.ElementType;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 py-3" style={{ borderBottom: '1px solid hsl(var(--border) / 0.5)' }}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: 'hsl(var(--primary) / 0.12)' }}>
          <Icon className="w-4 h-4" style={{ color: 'hsl(var(--primary))' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium" style={{ color: 'hsl(var(--foreground))' }}>{label}</p>
          <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>{description}</p>
          <select
            value={value}
            onChange={e => onChange(e.target.value)}
            className="mt-2 w-full text-sm rounded-xl px-3 py-2 outline-none"
            style={{
              background: 'hsl(var(--muted))',
              color: 'hsl(var(--foreground))',
              border: '1px solid hsl(var(--border))',
            }}>
            {options.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  icon: Icon,
  value,
  onChange,
}: {
  label: string;
  description: string;
  icon: React.ElementType;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3 py-3" style={{ borderBottom: '1px solid hsl(var(--border) / 0.5)' }}>
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: 'hsl(var(--primary) / 0.12)' }}>
        <Icon className="w-4 h-4" style={{ color: 'hsl(var(--primary))' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: 'hsl(var(--foreground))' }}>{label}</p>
        <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className="flex-shrink-0 mt-1 w-11 h-6 rounded-full relative transition-colors"
        style={{ background: value ? 'hsl(var(--primary))' : 'hsl(var(--muted))', border: '1px solid hsl(var(--border))' }}>
        <span
          className="absolute top-0.5 w-5 h-5 rounded-full shadow transition-transform"
          style={{
            background: 'hsl(var(--background))',
            transform: value ? 'translateX(22px)' : 'translateX(2px)',
          }}
        />
      </button>
    </div>
  );
}

export default function MessagingPrivacyModal({ open, onClose }: Props) {
  const [settings, setSettings] = useState<PrivacySettings>(DEFAULTS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch('/api/messaging/privacy', { credentials: 'include' })
      .then(r => r.ok ? r.json() as Promise<{ settings: PrivacySettings }> : null)
      .then(data => { if (data) setSettings(data.settings); })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [open]);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch('/api/messaging/privacy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(settings),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  function update<K extends keyof PrivacySettings>(key: K, value: PrivacySettings[K]) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  const visibilityOptions = [
    { value: 'everyone', label: 'Everyone' },
    { value: 'connections', label: 'Coven connections only' },
    { value: 'nobody', label: 'Nobody' },
  ];

  const messageOptions = [
    { value: 'everyone', label: 'Everyone' },
    { value: 'requests', label: 'Message requests required' },
    { value: 'connections', label: 'Coven connections only' },
    { value: 'nobody', label: 'Nobody' },
  ];

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50"
            style={{ background: 'hsl(var(--background) / 0.8)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
          />
          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl overflow-hidden"
            style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', maxHeight: '90dvh' }}>
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: 'hsl(var(--border))' }} />
            </div>
            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5" style={{ color: 'hsl(var(--primary))' }} />
                <h2 className="font-serif text-lg font-semibold" style={{ color: 'hsl(var(--foreground))' }}>
                  Messaging Privacy
                </h2>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}
                aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Content */}
            <div className="overflow-y-auto px-5 pb-6" style={{ maxHeight: 'calc(90dvh - 120px)' }}>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 rounded-full border-2 animate-spin"
                    style={{ borderColor: 'hsl(var(--primary))', borderTopColor: 'transparent' }} />
                </div>
              ) : (
                <>
                  <SelectRow
                    label="Who can message me"
                    description="Control who can send you direct messages"
                    icon={MessageCircle}
                    value={settings.whoCanMessage}
                    options={messageOptions}
                    onChange={v => update('whoCanMessage', v)}
                  />
                  <SelectRow
                    label="Online presence"
                    description="Who can see when you're active"
                    icon={Eye}
                    value={settings.presenceVisibility}
                    options={visibilityOptions}
                    onChange={v => update('presenceVisibility', v)}
                  />
                  <SelectRow
                    label="Group invitations"
                    description="Who can invite you to group chats"
                    icon={Users}
                    value={settings.groupInvitePermission}
                    options={visibilityOptions}
                    onChange={v => update('groupInvitePermission', v)}
                  />
                  <ToggleRow
                    label="Typing indicators"
                    description="Show when you're typing a message"
                    icon={MessageCircle}
                    value={settings.showTypingIndicators}
                    onChange={v => update('showTypingIndicators', v)}
                  />
                  <ToggleRow
                    label="Read receipts"
                    description="Show when you've read a message"
                    icon={Eye}
                    value={settings.showReadReceipts}
                    onChange={v => update('showReadReceipts', v)}
                  />
                  <ToggleRow
                    label="Voice messages"
                    description="Allow others to send you voice messages"
                    icon={Mic}
                    value={settings.allowVoiceMessages}
                    onChange={v => update('allowVoiceMessages', v)}
                  />
                  <ToggleRow
                    label="Notification preview"
                    description="Show message content in notifications"
                    icon={Bell}
                    value={settings.notificationPreview}
                    onChange={v => update('notificationPreview', v)}
                  />
                </>
              )}
            </div>
            {/* Save button */}
            <div className="px-5 pb-6 pt-2" style={{ borderTop: '1px solid hsl(var(--border))' }}>
              <button
                onClick={() => void handleSave()}
                disabled={saving || loading}
                className="w-full py-3 rounded-full text-sm font-semibold transition-opacity disabled:opacity-50"
                style={{ background: saved ? 'hsl(var(--success))' : 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Settings'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
