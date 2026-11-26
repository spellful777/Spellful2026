import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { Helmet } from '@dr.pogodin/react-helmet';
import { motion, AnimatePresence } from 'motion/react';
import { useSession } from '@/lib/auth/auth-client';
import { OnlineDot } from '@/components/OnlineDot';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Send, Lock, MessageCircle, ArrowLeft, ShieldCheck, ShieldOff,
  Trash2, FileText, Inbox, MoreVertical, RotateCcw, PenSquare,
  Search, X as XIcon, Users, Check, CheckCheck,
  CornerUpLeft, Pencil, Palette, UserCheck, Settings,
  type LucideIcon,
} from 'lucide-react';
import { getOrCreateKeyPair, encryptMessage, decryptMessage } from '@/lib/dm-crypto';
import { messages as pageContent } from 'virtual:content';
import { usePwa } from '@/hooks/usePwa';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { InstallBanner } from '@/components/InstallSpellful';
import MessengerWallpaperPicker, { MESSENGER_THEMES, type WallpaperPrefs } from '@/components/MessengerWallpaperPicker';
import MessengerSearchPanel from '@/components/MessengerSearchPanel';
import MessagingPrivacyModal from '@/components/MessagingPrivacyModal';
import BlockedMembersModal from '@/components/BlockedMembersModal';
import RichMessageCard, { isRichCard } from '@/components/RichMessageCard';
import ActiveNowStrip from '@/components/ActiveNowStrip';
import { useMessengerSSE } from '@/hooks/useMessengerSSE';

// ── Types ─────────────────────────────────────────────────────────────────────

type MessageStatus = 'sent' | 'draft' | 'trashed' | 'deleted';
type Folder = 'inbox' | 'requests' | 'drafts' | 'trash';
type CovenStatus = 'accepted' | 'pending_sent' | 'pending_received' | 'declined' | null;

interface OtherUser {
  id: string;
  name: string | null;
  image: string | null;
  username: string | null;
}

interface ConversationSummary {
  id: number;
  updatedAt: string;
  otherUser: OtherUser | null;
  lastMessage: { ciphertext: string; iv: string; senderId: string; createdAt: string; systemMessage?: string | null } | null;
  unreadCount: number;
  requestStatus?: string | null;
  requesterId?: string | null;
  isArchived?: boolean;
  isStarred?: boolean;
  isPinned?: boolean;
  isMuted?: boolean;
  isHidden?: boolean;
  isCoven?: boolean;
}

interface Reaction {
  emoji: string;
  count: number;
  userIds: string[];
}

interface GroupSummary {
  id: number;
  name: string;
  description: string;
  avatarUrl: string | null;
  createdBy: string;
  role: string;
  memberCount: number;
  unreadCount: number;
  isArchived: boolean;
  isPinned: boolean;
  isMuted: boolean;
  lastMessage: { content: string | null; senderId: string; createdAt: string } | null;
  updatedAt: string;
}

interface GroupMessage {
  id: number;
  groupId: number;
  senderId: string;
  senderName: string | null;
  senderUsername: string | null;
  senderImage: string | null;
  content: string;
  systemMessage: string | null;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
}

interface GroupMember {
  userId: string;
  name: string | null;
  username: string | null;
  image: string | null;
  role: string;
  joinedAt: string;
}

interface GroupInvitation {
  id: number;
  groupId: number;
  groupName: string;
  inviterId: string;
  inviterName: string | null;
  inviterUsername: string | null;
  createdAt: string;
}

interface Message {
  id: number;
  conversationId: number;
  senderId: string;
  ciphertext: string;
  iv: string;
  status: MessageStatus;
  readAt: string | null;
  createdAt: string;
  plaintext?: string;
  systemMessage?: string | null; // plaintext for Spellful Team system messages
  replyToId?: number | null;
  editedAt?: string | null;
  deletedAt?: string | null;
  reactions?: Reaction[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function richCardPreview(systemMessage: string): string {
  try {
    const c = JSON.parse(systemMessage) as { type?: string; emoji?: string; title?: string };
    if (['blessing', 'spell', 'ritual', 'tarot_reading'].includes(c.type ?? '')) {
      return (c.emoji ?? '✨') + ' ' + (c.title ?? 'Shared content');
    }
  } catch { /* fall through */ }
  return '✨ Welcome to Spellful!';
}

function Avatar({ user, size = 44 }: { user: OtherUser | null; size?: number }) {
  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() ?? '?';
  return (
    <div
      className="rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
      style={{
        width: size, height: size,
        background: 'linear-gradient(135deg, hsl(var(--accent)) 0%, hsl(var(--primary)) 100%)',
        border: '2px solid hsl(var(--border))',
      }}
    >
      {user?.image ? (
        <img src={user.image} alt={user.name ?? ''} className="w-full h-full object-cover" />
      ) : (
        <span className="font-serif font-semibold text-sm" style={{ color: 'hsl(var(--primary-foreground))' }}>
          {initials}
        </span>
      )}
    </div>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

// ── Desktop thread sub-component ──────────────────────────────────────────────

interface DesktopThreadProps {
  refreshOtherUserKey: () => Promise<void>;
  deleteConversation: () => Promise<void>;
  activeOtherUser: OtherUser | null;
  messages: Message[];
  loadingMsgs: boolean;
  folder: Folder;
  switchFolder: (f: Folder) => Promise<void>;
  myId: string;
  draft: string;
  setDraft: (v: string) => void;
  sending: boolean;
  handleSend: () => Promise<void>;
  otherUserPublicKey: string | null;
  openMenuId: number | null;
  setOpenMenuId: (id: number | null) => void;
  updateMessageStatus: (id: number, status: MessageStatus) => Promise<void>;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  otherIsTyping: boolean;
  lastReadMsgId: number | null;
  replyTo: Message | null;
  setReplyTo: (m: Message | null) => void;
  editingMsg: Message | null;
  setEditingMsg: (m: Message | null) => void;
  reactionPickerMsgId: number | null;
  setReactionPickerMsgId: (id: number | null) => void;
  toggleReaction: (msgId: number, emoji: string) => Promise<void>;
  softDeleteMessage: (msgId: number) => Promise<void>;
  wallpaper: WallpaperPrefs;
  isCoven: boolean;
  covenStatus: CovenStatus;
  covenConnectionId: number | null;
  onCovenAction: (action: 'send' | 'accept' | 'decline') => Promise<void>;
  onOpenWallpaperPicker: () => void;
  onSaveWallpaper: (prefs: WallpaperPrefs) => void;
  activeConvId: number | null;
  showSearch: boolean;
  onToggleSearch: () => void;
  onSearchJump: (messageId: number) => void;
  sendError: string | null;
  hasMoreMessages: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  deleteForSelf: (msgId: number) => void;
  showSharedMedia: boolean;
  onToggleSharedMedia: () => void;
  onReportMessage: (msgId: number) => void;
  onBlockUser: (userId: string) => void;
}

function DesktopThread({
  activeOtherUser, messages, loadingMsgs, folder, switchFolder, myId,
  draft, setDraft, sending, handleSend, otherUserPublicKey,
  openMenuId, setOpenMenuId, updateMessageStatus, bottomRef, inputRef,
  otherIsTyping, lastReadMsgId,
  replyTo, setReplyTo, editingMsg, setEditingMsg,
  reactionPickerMsgId, setReactionPickerMsgId, toggleReaction,
  softDeleteMessage, wallpaper, isCoven, covenStatus, onCovenAction,
  onSaveWallpaper, activeConvId,
  showSearch, onToggleSearch, onSearchJump, sendError,
  refreshOtherUserKey, deleteConversation,
  hasMoreMessages, loadingOlder, onLoadOlder, deleteForSelf,
  showSharedMedia, onToggleSharedMedia, onReportMessage, onBlockUser,
}: DesktopThreadProps) {
  const navigate = useNavigate();
  const [showWallpaperInline, setShowWallpaperInline] = React.useState(false);
  return (
    <>
      {/* Thread header */}
      <div className="flex items-center gap-3 p-4" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
        <button
          type="button"
          onClick={() => { if (activeOtherUser?.username) navigate(`/u/${activeOtherUser.username}`); }}
          className="relative flex-shrink-0 cursor-pointer disabled:cursor-default"
          disabled={!activeOtherUser?.username}
          aria-label={activeOtherUser?.username ? `View ${activeOtherUser.name ?? activeOtherUser.username}'s profile` : undefined}>
          <Avatar user={activeOtherUser} size={36} />
          {activeOtherUser && (
            <div className="absolute -bottom-0.5 -right-0.5">
              <OnlineDot userId={activeOtherUser.id} size={9} />
            </div>
          )}
        </button>
        <button
          type="button"
          onClick={() => { if (activeOtherUser?.username) navigate(`/u/${activeOtherUser.username}`); }}
          className="flex-1 min-w-0 text-left cursor-pointer disabled:cursor-default"
          disabled={!activeOtherUser?.username}
          aria-label={activeOtherUser?.username ? `View ${activeOtherUser.name ?? activeOtherUser.username}'s profile` : undefined}>
          <p className="font-medium text-sm truncate hover:underline" style={{ color: 'hsl(var(--foreground))' }}>
            {activeOtherUser?.name ?? activeOtherUser?.username ?? 'Unknown'}
          </p>
          <AnimatePresence mode="wait">
            {otherIsTyping ? (
              <motion.p key="typing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-xs" style={{ color: 'hsl(var(--primary))' }}>
                typing…
              </motion.p>
            ) : activeOtherUser?.username ? (
              <motion.p key="username" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                @{activeOtherUser.username}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </button>
        <div className="ml-auto flex items-center gap-1 text-xs flex-shrink-0" style={{ color: 'hsl(var(--muted-foreground))' }}>
          <button
            onClick={onToggleSearch}
            className="w-7 h-7 rounded-full flex items-center justify-center mr-0.5"
            style={{
              background: showSearch ? 'hsl(var(--primary) / 0.15)' : 'hsl(var(--muted))',
              color: showSearch ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
            }}
            aria-label="Search messages">
            <Search className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onToggleSharedMedia}
            className="w-7 h-7 rounded-full flex items-center justify-center mr-0.5"
            style={{
              background: showSharedMedia ? 'hsl(var(--primary) / 0.15)' : 'hsl(var(--muted))',
              color: showSharedMedia ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
            }}
            aria-label="Shared media">
            <Users className="w-3.5 h-3.5" />
          </button>
          {isCoven && (
            <button
              onClick={() => setShowWallpaperInline(v => !v)}
              className="w-7 h-7 rounded-full flex items-center justify-center mr-1 transition-all"
              style={{
                background: showWallpaperInline ? 'hsl(var(--primary) / 0.15)' : 'hsl(var(--muted))',
                color: showWallpaperInline ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
              }}
              aria-label="Chat appearance">
              <Palette className="w-3.5 h-3.5" />
            </button>
          )}
          <Lock className="w-3 h-3" style={{ color: 'hsl(var(--success))' }} />
          <span>{pageContent.encryptedShort}</span>
        </div>
      </div>

      {/* ── Phase 5: Search panel ── */}
      <AnimatePresence>
        {showSearch && (
          <MessengerSearchPanel
            messages={messages}
            myId={myId}
            otherUserName={activeOtherUser?.name ?? activeOtherUser?.username ?? 'Them'}
            onClose={onToggleSearch}
            onJumpTo={onSearchJump}
          />
        )}
      </AnimatePresence>

      {/* ── Shared media panel ── */}
      <AnimatePresence>
        {showSharedMedia && (
          <motion.div
            key="shared-media"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
            style={{ borderBottom: '1px solid hsl(var(--border))' }}>
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold" style={{ color: 'hsl(var(--foreground))' }}>Shared links</p>
                <button onClick={onToggleSharedMedia} aria-label="Close" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              </div>
              {(() => {
                const urlPattern = /https?:\/\/\S+/;
                const links = messages.filter(m => !m.deletedAt && m.plaintext && urlPattern.test(m.plaintext));
                if (links.length === 0) return (
                  <p className="text-xs text-center py-4" style={{ color: 'hsl(var(--muted-foreground))' }}>No shared links yet</p>
                );
                return (
                  <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
                    {links.slice(-20).reverse().map(m => {
                      const urlMatch = (m.plaintext ?? '').match(/https?:\/\/\S+/);
                      const url = urlMatch ? urlMatch[0] : '';
                      return (
                        <a key={m.id} href={url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs hover:opacity-80 transition-opacity"
                          style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--primary))' }}>
                          <span className="truncate flex-1">{url}</span>
                          <span className="flex-shrink-0 text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>{formatTime(m.createdAt)}</span>
                        </a>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Inline wallpaper/appearance panel ── */}
      <AnimatePresence>
        {showWallpaperInline && (
          <motion.div
            key="wallpaper-inline"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
            style={{ borderBottom: '1px solid hsl(var(--border))' }}>
            <MessengerWallpaperPicker
              conversationId={activeConvId ?? 0}
              current={wallpaper}
              onClose={() => setShowWallpaperInline(false)}
              onSave={(prefs) => { onSaveWallpaper(prefs); setShowWallpaperInline(false); }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Folder tabs */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-0" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
        {([
          { id: 'inbox', label: 'Inbox', icon: Inbox },
          { id: 'requests', label: 'Requests', icon: UserCheck },
          { id: 'drafts', label: 'Drafts', icon: FileText },
          { id: 'trash', label: 'Trash', icon: Trash2 },
        ] as { id: Folder; label: string; icon: LucideIcon }[]).map(tab => (
          <button key={tab.id} onClick={() => void switchFolder(tab.id)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-t-lg transition-colors"
            style={{
              color: folder === tab.id ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
              borderBottom: folder === tab.id ? '2px solid hsl(var(--primary))' : '2px solid transparent',
            }}>
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 relative" onClick={() => setOpenMenuId(null)}>
        {/* Wallpaper background */}
        {(() => {
          const theme = MESSENGER_THEMES.find(t => t.id === wallpaper.themeId);
          const bgStyle: React.CSSProperties = wallpaper.themeId === 'custom' && wallpaper.customImageUrl
            ? { backgroundImage: `url(${wallpaper.customImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'local' }
            : theme?.backgroundStyle
              ? { background: theme.backgroundStyle }
              : {};
          return Object.keys(bgStyle).length > 0 ? (
            <>
              <div className="absolute inset-0 pointer-events-none" style={{
                ...bgStyle,
                ...(wallpaper.blurAmount > 0 ? { filter: `blur(${wallpaper.blurAmount}px)`, transform: 'scale(1.05)' } : {}),
              }} />
              {wallpaper.dimAmount > 0 && (
                <div className="absolute inset-0 pointer-events-none"
                  style={{ background: `hsl(var(--background) / ${wallpaper.dimAmount / 100})` }} />
              )}
            </>
          ) : null;
        })()}
        {/* Load older messages */}
        {hasMoreMessages && !loadingMsgs && (
          <div className="flex justify-center pt-2 pb-1">
            <button
              onClick={onLoadOlder}
              disabled={loadingOlder}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))', border: '1px solid hsl(var(--border))' }}>
              {loadingOlder ? (
                <><span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin inline-block" />Loading…</>
              ) : (
                <>↑ Load older messages</>
              )}
            </button>
          </div>
        )}
        <div className="flex items-center justify-center gap-1.5 py-1">
          {folder === 'inbox' && (
            <><Lock className="w-3 h-3" style={{ color: 'hsl(var(--success))' }} />
            <span className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Private conversation</span></>
          )}
          {folder === 'drafts' && (
            <><FileText className="w-3 h-3" style={{ color: 'hsl(var(--muted-foreground))' }} />
            <span className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Drafts — only visible to you</span></>
          )}
          {folder === 'trash' && (
            <><Trash2 className="w-3 h-3" style={{ color: 'hsl(var(--muted-foreground))' }} />
            <span className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Trash — only visible to you</span></>
          )}
        </div>

        {loadingMsgs ? (
          <div className="flex flex-col gap-3 pt-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'} animate-pulse`}>
                <div className="h-10 rounded-3xl" style={{ width: `${35 + i * 12}%`, background: 'hsl(var(--muted))' }} />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-sm py-8" style={{ color: 'hsl(var(--muted-foreground))' }}>
            {folder === 'drafts' ? 'No drafts.' : folder === 'trash' ? 'Trash is empty.' : pageContent.emptyMessages}
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg, idx) => {
              const isMine = msg.senderId === myId;
              const isSystem = !!msg.systemMessage;
              const isRich = isRichCard(msg.systemMessage);
              const prevMsg: Message | undefined = idx > 0 ? messages[idx - 1] : undefined;
              const showDateSep = !prevMsg || new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();
              const isLastMine = isMine && !isSystem && messages.slice(idx + 1).every(m => m.senderId !== myId || !!m.systemMessage);
              return (
                <React.Fragment key={msg.id}>
                  {showDateSep && (
                    <div className="flex items-center gap-3 py-2">
                      <div className="flex-1 h-px" style={{ background: 'hsl(var(--border))' }} />
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: 'hsl(var(--muted-foreground))', background: 'hsl(var(--muted))' }}>{formatDateLabel(msg.createdAt)}</span>
                      <div className="flex-1 h-px" style={{ background: 'hsl(var(--border))' }} />
                    </div>
                  )}
                  <motion.div
                    id={`msg-${msg.id}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={'flex ' + (isMine ? 'justify-end' : 'justify-start')}>
                  <div className={isSystem ? 'w-full max-w-[90%]' : 'min-w-0 max-w-[75%] [overflow-wrap:anywhere]'} style={{ marginLeft: isSystem ? 'auto' : undefined, marginRight: isSystem ? 'auto' : undefined }}>
                    <div className="relative group">
                      {isRich && msg.systemMessage ? (
                        <RichMessageCard systemMessage={msg.systemMessage} isMine={isMine} />
                      ) : isSystem ? (
                        <div className="rounded-2xl overflow-hidden"
                          style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
                          <img
                            src="/airo-assets/images/logo/official-white"
                            alt="Welcome to Spellful"
                            className="w-full object-cover"
                            style={{ maxHeight: 180 }}
                            loading="eager"
                          />
                          <div className="px-5 py-4 text-sm whitespace-pre-line"
                            style={{ color: 'hsl(var(--foreground))', lineHeight: 1.7, fontFamily: 'var(--font-sans)' }}>
                            {msg.plaintext}
                          </div>
                          <div className="px-5 pb-3 text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                            {formatTime(msg.createdAt)}
                          </div>
                        </div>
                      ) : (
                      <div>
                        {/* Reply-to quote */}
                        {msg.replyToId && (() => {
                          const quoted = messages.find(m => m.id === msg.replyToId);
                          return quoted ? (
                            <div className="mb-1 px-3 py-1.5 rounded-xl text-xs opacity-70 border-l-2"
                              style={{
                                background: isMine ? 'hsl(var(--primary) / 0.3)' : 'hsl(var(--card))',
                                borderLeftColor: 'hsl(var(--accent))',
                                color: isMine ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
                              }}>
                              <span className="font-medium mr-1">{quoted.senderId === myId ? 'You' : (activeOtherUser?.name ?? activeOtherUser?.username ?? 'Them')}:</span>
                              <span className="line-clamp-1">{quoted.deletedAt ? 'Message deleted' : (quoted.plaintext ?? '🔒')}</span>
                            </div>
                          ) : null;
                        })()}
                        {/* Bubble */}
                        <div className="px-4 py-2.5 text-sm"
                          style={{
                            background: msg.deletedAt ? 'transparent' : msg.status === 'draft' ? 'hsl(var(--muted))' : isMine ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                            color: msg.deletedAt ? 'hsl(var(--muted-foreground))' : msg.status === 'draft' ? 'hsl(var(--muted-foreground))' : isMine ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
                            borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                            opacity: msg.status === 'draft' ? 0.75 : 1,
                            border: msg.deletedAt ? '1px dashed hsl(var(--border))' : msg.status === 'draft' ? '1px dashed hsl(var(--border))' : undefined,
                            fontStyle: msg.deletedAt ? 'italic' : undefined,
                          }}>
                          {msg.deletedAt ? 'Message deleted' : (msg.plaintext ?? '🔒 Encrypted')}
                          {msg.status === 'draft' && !msg.deletedAt && (
                            <span className="ml-2 text-xs italic" style={{ color: 'hsl(var(--muted-foreground))' }}>Draft</span>
                          )}
                        </div>
                      </div>
                      )}
                      {/* Hover action bar — reaction + reply + menu */}
                      {!isSystem && !msg.deletedAt && (
                        <div className={'absolute top-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ' + (isMine ? '-left-24' : '-right-24')}>
                          {/* Reaction picker trigger */}
                          <div className="relative">
                            <button
                              onClick={(e) => { e.stopPropagation(); setReactionPickerMsgId(reactionPickerMsgId === msg.id ? null : msg.id); }}
                              className="w-7 h-7 rounded-full flex items-center justify-center text-sm hover:scale-110 transition-transform"
                              style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))' }}
                              aria-label="React">
                              😊
                            </button>
                            <AnimatePresence>
                              {reactionPickerMsgId === msg.id && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.85, y: 4 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.85, y: 4 }}
                                  transition={{ duration: 0.15 }}
                                  className="absolute bottom-9 left-0 flex gap-1 px-2 py-1.5 rounded-2xl shadow-xl z-30"
                                  style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                                  onClick={e => e.stopPropagation()}>
                                  {['👍', '❤️', '✨', '🌙', '🔮', '🕯️', '🌿', '⚡'].map(emoji => {
                                    const myReaction = msg.reactions?.find(r => r.emoji === emoji && r.userIds.includes(myId));
                                    return (
                                      <button key={emoji} onClick={() => void toggleReaction(msg.id, emoji)}
                                        className="text-lg hover:scale-125 transition-transform rounded-full w-8 h-8 flex items-center justify-center"
                                        style={{ background: myReaction ? 'hsl(var(--primary) / 0.2)' : 'transparent' }}
                                        aria-label={emoji}>
                                        {emoji}
                                      </button>
                                    );
                                  })}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                          {/* Reply */}
                          <button
                            onClick={() => { setReplyTo(msg); setReactionPickerMsgId(null); }}
                            className="w-7 h-7 rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                            style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}
                            aria-label="Reply">
                            <CornerUpLeft className="w-3.5 h-3.5" />
                          </button>
                          {/* Menu (own messages only) */}
                          {isMine && (
                            <div className="relative">
                              <button
                                onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === msg.id ? null : msg.id); }}
                                className="w-7 h-7 rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                                style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}
                                aria-label="Message options">
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>
                              {openMenuId === msg.id && (
                                <div className="absolute bottom-9 left-0 z-20 rounded-xl shadow-xl py-1 min-w-[150px]"
                                  style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                                  onClick={e => e.stopPropagation()}>
                                  {msg.status === 'sent' && (
                                    <button onClick={() => { setEditingMsg(msg); setDraft(msg.plaintext ?? ''); setOpenMenuId(null); }}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:opacity-80"
                                      style={{ color: 'hsl(var(--foreground))' }}>
                                      <Pencil className="w-3.5 h-3.5" />Edit
                                    </button>
                                  )}
                                  {msg.status === 'draft' && (
                                    <button onClick={() => void updateMessageStatus(msg.id, 'sent')}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:opacity-80"
                                      style={{ color: 'hsl(var(--success))' }}>
                                      <Send className="w-3.5 h-3.5" />Send now
                                    </button>
                                  )}
                                  {msg.status === 'trashed' && (
                                    <button onClick={() => void updateMessageStatus(msg.id, 'sent')}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:opacity-80"
                                      style={{ color: 'hsl(var(--foreground))' }}>
                                      <RotateCcw className="w-3.5 h-3.5" />Restore
                                    </button>
                                  )}
                                  {msg.status !== 'trashed' && (
                                    <button onClick={() => void updateMessageStatus(msg.id, 'trashed')}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:opacity-80"
                                      style={{ color: 'hsl(var(--warning))' }}>
                                      <Trash2 className="w-3.5 h-3.5" />Move to trash
                                    </button>
                                  )}
                                  <button onClick={() => { deleteForSelf(msg.id); setOpenMenuId(null); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:opacity-80"
                                    style={{ color: 'hsl(var(--muted-foreground))' }}>
                                    <Trash2 className="w-3.5 h-3.5" />Delete for me
                                  </button>
                                  <button onClick={() => void softDeleteMessage(msg.id)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:opacity-80"
                                    style={{ color: 'hsl(var(--destructive))' }}>
                                    <Trash2 className="w-3.5 h-3.5" />Delete for everyone
                                  </button>
                                  {!isMine && (
                                    <>
                                      <div style={{ borderTop: '1px solid hsl(var(--border))' }} className="my-1" />
                                      <button onClick={() => { setOpenMenuId(null); onReportMessage(msg.id); }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:opacity-80"
                                        style={{ color: 'hsl(var(--destructive))' }}>
                                        🚩 Report message
                                      </button>
                                      {activeOtherUser && (
                                        <button onClick={() => { setOpenMenuId(null); onBlockUser(activeOtherUser.id); }}
                                          className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:opacity-80"
                                          style={{ color: 'hsl(var(--destructive))' }}>
                                          🚫 Block member
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {/* Reactions row */}
                    {!isSystem && (msg.reactions?.length ?? 0) > 0 && (
                      <div className={'flex flex-wrap gap-1 mt-1 ' + (isMine ? 'justify-end' : 'justify-start')}>
                        {(msg.reactions ?? []).map(r => (
                          <button key={r.emoji} onClick={() => void toggleReaction(msg.id, r.emoji)}
                            className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs hover:opacity-80 transition-opacity"
                            style={{
                              background: r.userIds.includes(myId) ? 'hsl(var(--primary) / 0.2)' : 'hsl(var(--muted))',
                              border: r.userIds.includes(myId) ? '1px solid hsl(var(--primary) / 0.4)' : '1px solid hsl(var(--border))',
                              color: 'hsl(var(--foreground))',
                            }}>
                            <span>{r.emoji}</span>
                            <span style={{ color: 'hsl(var(--muted-foreground))' }}>{r.count}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {!isSystem && (
                    <div className={'flex items-center gap-1.5 text-xs px-1 ' + (isMine ? 'justify-end' : 'justify-start')}
                      style={{ color: 'hsl(var(--muted-foreground))' }}>
                      {formatTime(msg.createdAt)}
                      {msg.editedAt && !msg.deletedAt && <span className="italic">· edited</span>}
                      {isMine && isLastMine && (
                        <span className="flex items-center gap-0.5">
                          {(lastReadMsgId !== null && msg.id <= lastReadMsgId) || msg.readAt
                            ? <><CheckCheck className="w-3 h-3" style={{ color: 'hsl(var(--success))' }} /><span style={{ color: 'hsl(var(--success))' }}>Read</span></>
                            : <><Check className="w-3 h-3" /><span>Sent</span></>
                          }
                        </span>
                      )}
                    </div>
                    )}
                  </div>
                  </motion.div>
                </React.Fragment>
              );
            })}
            {otherIsTyping && (
              <motion.div
                key="typing"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                className="flex justify-start">
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-[18px_18px_18px_4px]"
                  style={{ background: 'hsl(var(--muted))', maxWidth: '80px' }}>
                  <span className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
                        style={{ background: 'hsl(var(--muted-foreground))', animationDelay: i * 0.15 + 's' }} />
                    ))}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
        {/* Coven accepted notification */}
        {covenStatus === 'accepted' && messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-1 py-6 px-4 text-center">
            <span className="text-2xl">✨</span>
            <p className="text-sm font-medium" style={{ color: 'hsl(var(--primary))' }}>
              You're now Coven friends with {activeOtherUser?.name ?? activeOtherUser?.username ?? 'them'}!
            </p>
            <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Send your first message.</p>
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Coven connection banner — shown when not yet accepted friends */}
      {folder === 'inbox' && covenStatus !== 'accepted' && (
        <div className="px-4 py-3 flex flex-col gap-2" style={{ borderTop: '1px solid hsl(var(--border))', background: 'hsl(var(--muted))' }}>
          {covenStatus === null && (
            <>
              <p className="text-xs text-center" style={{ color: 'hsl(var(--muted-foreground))' }}>
                You're not Coven friends yet. Send a request to unlock full messaging.
              </p>
              <button
                onClick={() => void onCovenAction('send')}
                className="w-full py-2 rounded-full text-sm font-medium transition-opacity hover:opacity-80"
                style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                Send Coven Request
              </button>
            </>
          )}
          {covenStatus === 'pending_sent' && (
            <p className="text-xs text-center py-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
              ✨ Coven request sent — waiting for {activeOtherUser?.name ?? activeOtherUser?.username ?? 'them'} to accept.
            </p>
          )}
          {covenStatus === 'pending_received' && (
            <>
              <p className="text-xs text-center" style={{ color: 'hsl(var(--muted-foreground))' }}>
                {activeOtherUser?.name ?? activeOtherUser?.username ?? 'They'} sent you a Coven request.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => void onCovenAction('accept')}
                  className="flex-1 py-2 rounded-full text-sm font-medium transition-opacity hover:opacity-80"
                  style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                  Accept
                </button>
                <button
                  onClick={() => void onCovenAction('decline')}
                  className="flex-1 py-2 rounded-full text-sm font-medium transition-opacity hover:opacity-80"
                  style={{ background: 'hsl(var(--muted-foreground) / 0.2)', color: 'hsl(var(--foreground))' }}>
                  Decline
                </button>
              </div>
            </>
          )}
          {covenStatus === 'declined' && (
            <p className="text-xs text-center py-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
              Coven request was declined.
            </p>
          )}
        </div>
      )}

      {/* Send bar — always shown in inbox regardless of Coven status */}
      {folder === 'inbox' && (
        <div className="p-4" style={{ borderTop: '1px solid hsl(var(--border))' }}>
          <>
              {/* Reply-to context bar */}
              <AnimatePresence>
                {replyTo && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 mb-2 px-3 py-2 rounded-xl"
                    style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))' }}>
                    <CornerUpLeft className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'hsl(var(--accent))' }} />
                    <span className="text-xs flex-1 truncate" style={{ color: 'hsl(var(--muted-foreground))' }}>
                      <span className="font-medium" style={{ color: 'hsl(var(--foreground))' }}>
                        {replyTo.senderId === myId ? 'You' : (activeOtherUser?.name ?? activeOtherUser?.username ?? 'Them')}:
                      </span>{' '}
                      {replyTo.plaintext ?? '🔒'}
                    </span>
                    <button onClick={() => setReplyTo(null)} aria-label="Cancel reply"
                      className="flex-shrink-0 hover:opacity-70" style={{ color: 'hsl(var(--muted-foreground))' }}>
                      <XIcon className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                )}
                {/* Edit context bar */}
                {editingMsg && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 mb-2 px-3 py-2 rounded-xl"
                    style={{ background: 'hsl(var(--primary) / 0.1)', border: '1px solid hsl(var(--primary) / 0.3)' }}>
                    <Pencil className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'hsl(var(--primary))' }} />
                    <span className="text-xs flex-1" style={{ color: 'hsl(var(--primary))' }}>Editing message</span>
                    <button onClick={() => { setEditingMsg(null); setDraft(''); }} aria-label="Cancel edit"
                      className="flex-shrink-0 hover:opacity-70" style={{ color: 'hsl(var(--primary))' }}>
                      <XIcon className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
              <form onSubmit={(e) => { e.preventDefault(); void handleSend(); }} className="flex items-center gap-2">
                <Input
                  ref={inputRef}
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onFocus={() => void refreshOtherUserKey()}
                  placeholder={editingMsg ? 'Edit your message…' : 'Write a message…'}
                  className="flex-1 rounded-full bg-muted border-border"
                  maxLength={2000}
                  autoComplete="off"
                />
                <Button type="submit" size="icon" disabled={!draft.trim() || sending}
                  className="rounded-full bg-primary text-primary-foreground flex-shrink-0">
                  {editingMsg ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                </Button>
              </form>
              {sendError && (
                <p className="text-xs text-center px-2" style={{ color: 'hsl(var(--destructive))' }}>{sendError}</p>
              )}
              {!otherUserPublicKey && !sendError && (
                <p className="text-xs text-center" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  Your message will be sent now. Full encryption activates once they open Messages.
                </p>
              )}
              <div className="flex items-center justify-center gap-2 mt-1.5">
                <Lock className="w-2.5 h-2.5" style={{ color: 'hsl(var(--success))' }} />
                <span className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Private conversation</span>
                <button
                  onClick={() => {
                    if (window.confirm('Delete this conversation? This cannot be undone.')) {
                      void deleteConversation();
                    }
                  }}
                  className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-opacity hover:opacity-80"
                  style={{ background: 'hsl(var(--destructive) / 0.12)', color: 'hsl(var(--destructive))' }}
                  aria-label="Delete conversation">
                  <Trash2 className="w-3 h-3" />Delete
                </button>
              </div>
            </>
        </div>
      )}
    </>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const { session, isPending } = useSession();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeOtherUser, setActiveOtherUser] = useState<OtherUser | null>(null);
  const [otherUserPublicKey, setOtherUserPublicKey] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [convLoadError, setConvLoadError] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [keyReady, setKeyReady] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list');
  const [folder, setFolder] = useState<Folder>('inbox');
  type MsgRequest = { id: number; conversationId: number; requesterId: string; status: string; createdAt: string | null; requesterName: string | null; requesterUsername: string | null; requesterImage: string | null };
  const [msgRequests, setMsgRequests] = useState<MsgRequest[]>([]);
  const [msgRequestsLoaded, setMsgRequestsLoaded] = useState(false);
  const [requestActionId, setRequestActionId] = useState<number | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  // Install state managed by shared InstallBanner component
  const [testNotifStatus, setTestNotifStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  // ── Inbox search + filter ─────────────────────────────────────────────────
  const [inboxSearch, setInboxSearch] = useState('');
  const [inboxFilter, setInboxFilter] = useState<'all' | 'unread' | 'read' | 'requests' | 'groups' | 'archived'>('all');
  const [showPrivacySettings, setShowPrivacySettings] = useState(false);
  const [showBlockedMembers, setShowBlockedMembers] = useState(false);
  const [reportingMsgId, setReportingMsgId] = useState<number | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportDone, setReportDone] = useState(false);

  // ── Realtime: typing + receipts ───────────────────────────────────────────
  const [otherIsTyping, setOtherIsTyping] = useState(false);
  const [lastReadMsgId, setLastReadMsgId] = useState<number | null>(null);
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMsgTimestampRef = useRef<string | null>(null);

  // ── Phase 3: reply-to, edit, reactions ───────────────────────────────────
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState<number | null>(null);

  // ── Phase 4: wallpaper / theme ────────────────────────────────────────────
  const defaultWallpaper: WallpaperPrefs = { themeId: 'default', customImageUrl: null, dimAmount: 40, blurAmount: 0 };
  const [wallpaper, setWallpaper] = useState<WallpaperPrefs>(defaultWallpaper);
  const [isCoven, setIsCoven] = useState(false);
  const [covenStatus, setCovenStatus] = useState<CovenStatus>(null);
  const [covenConnectionId, setCovenConnectionId] = useState<number | null>(null);
  // showWallpaperPicker removed — wallpaper now inline

  // ── Phase 5: message search ───────────────────────────────────────────────
  const [showSearch, setShowSearch] = useState(false);
  const [showWallpaperMobile, setShowWallpaperMobile] = useState(false);

  // ── Pagination ────────────────────────────────────────────────────────────
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [oldestMsgId, setOldestMsgId] = useState<number | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);

  // ── Shared media panel ────────────────────────────────────────────────────
  const [showSharedMedia, setShowSharedMedia] = useState(false);

  // ── Batch presence for inbox list ─────────────────────────────────────────
  const [batchPresence, setBatchPresence] = useState<Record<string, { online: boolean; lastSeen: string | null }>>({});

  // ── Conversation-level context menu (archive / star / pin / mute / delete-for-me) ──
  const [convMenuId, setConvMenuId] = useState<number | null>(null);

  // ── New message compose sheet ─────────────────────────────────────────────
  const [showCompose, setShowCompose] = useState(false);
  const [composeQuery, setComposeQuery] = useState('');
  const [composeResults, setComposeResults] = useState<OtherUser[]>([]);
  const [composeSearching, setComposeSearching] = useState(false);
  const [composeStarting, setComposeStarting] = useState<string | null>(null);

  // ── Groups ────────────────────────────────────────────────────────────────
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [loadingGroupMsgs, setLoadingGroupMsgs] = useState(false);
  const [groupDraft, setGroupDraft] = useState('');
  const [sendingGroup, setSendingGroup] = useState(false);
  const [groupSendError, setGroupSendError] = useState<string | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showGroupInvitations, setShowGroupInvitations] = useState(false);
  const [groupInvitations, setGroupInvitations] = useState<GroupInvitation[]>([]);
  const [loadingGroupInvitations, setLoadingGroupInvitations] = useState(false);
  // Create group form state
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newGroupMemberIds, setNewGroupMemberIds] = useState<string[]>([]);
  const [newGroupMemberSearch, setNewGroupMemberSearch] = useState('');
  const [newGroupMemberResults, setNewGroupMemberResults] = useState<OtherUser[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  // horoscope state removed — strip removed from inbox per redesign spec
  const bottomRef = useRef<HTMLDivElement>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const myId = (session?.user as { id?: string } | undefined)?.id ?? '';

  // Register SW + request push permission once signed in
  usePwa(!!session);
  const { isInstalled } = usePWAInstall();

  // horoscope fetch removed — strip removed from inbox per redesign spec

  // ── Fetch groups when Groups tab is active ────────────────────────────────
  useEffect(() => {
    if (!session || inboxFilter !== 'groups') return;
    setLoadingGroups(true);
    fetch('/api/groups', { credentials: 'include' })
      .then(r => r.ok ? r.json() as Promise<{ groups: GroupSummary[] }> : null)
      .then(data => { if (data) setGroups(data.groups); })
      .catch(() => undefined)
      .finally(() => setLoadingGroups(false));
  }, [session, inboxFilter]);

  // ── Group thread: load messages + members ────────────────────────────────
  async function loadGroupThread(groupId: number) {
    setLoadingGroupMsgs(true);
    setGroupMessages([]);
    setGroupMembers([]);
    try {
      const [msgsRes, membersRes] = await Promise.all([
        fetch(`/api/groups/${groupId}/messages`, { credentials: 'include' }),
        fetch(`/api/groups/${groupId}/members`, { credentials: 'include' }),
      ]);
      if (msgsRes.ok) {
        const data = await msgsRes.json() as { messages: GroupMessage[] };
        setGroupMessages(data.messages ?? []);
      }
      if (membersRes.ok) {
        const data = await membersRes.json() as { members: GroupMember[] };
        setGroupMembers(data.members ?? []);
      }
    } catch { /* non-fatal */ }
    setLoadingGroupMsgs(false);
  }

  async function openGroupThread(groupId: number) {
    setActiveGroupId(groupId);
    setActiveConvId(null);
    setMobileView('thread');
    await loadGroupThread(groupId);
  }

  async function sendGroupMessage() {
    if (!groupDraft.trim() || !activeGroupId || sendingGroup) return;
    setSendingGroup(true);
    setGroupSendError(null);
    const content = groupDraft.trim();
    setGroupDraft('');
    try {
      const res = await fetch(`/api/groups/${activeGroupId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const data = await res.json() as { messageId?: number };
        const optimistic: GroupMessage = {
          id: data.messageId ?? Date.now(),
          groupId: activeGroupId,
          senderId: myId,
          senderName: null,
          senderUsername: null,
          senderImage: null,
          content,
          systemMessage: null,
          createdAt: new Date().toISOString(),
          editedAt: null,
          deletedAt: null,
        };
        setGroupMessages(prev => [...prev, optimistic]);
        setGroups(prev => prev.map(g => g.id === activeGroupId
          ? { ...g, lastMessage: { content, senderId: myId, createdAt: new Date().toISOString() }, updatedAt: new Date().toISOString() }
          : g));
      } else {
        setGroupSendError('Failed to send message');
        setGroupDraft(content);
      }
    } catch {
      setGroupSendError('Network error');
      setGroupDraft(content);
    }
    setSendingGroup(false);
  }

  async function createGroup() {
    if (!newGroupName.trim() || newGroupMemberIds.length === 0 || creatingGroup) return;
    setCreatingGroup(true);
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newGroupName.trim(), description: newGroupDescription.trim(), memberIds: newGroupMemberIds }),
      });
      if (res.ok) {
        const data = await res.json() as { groupId: number; name: string };
        setShowCreateGroup(false);
        setNewGroupName('');
        setNewGroupDescription('');
        setNewGroupMemberIds([]);
        setNewGroupMemberSearch('');
        setNewGroupMemberResults([]);
        // Refresh groups list and open the new group
        const groupsRes = await fetch('/api/groups', { credentials: 'include' });
        if (groupsRes.ok) {
          const groupsData = await groupsRes.json() as { groups: GroupSummary[] };
          setGroups(groupsData.groups);
        }
        await openGroupThread(data.groupId);
      }
    } catch { /* non-fatal */ }
    setCreatingGroup(false);
  }

  async function loadGroupInvitations() {
    setLoadingGroupInvitations(true);
    try {
      const res = await fetch('/api/groups/invitations', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json() as { invitations: GroupInvitation[] };
        setGroupInvitations(data.invitations ?? []);
      }
    } catch { /* non-fatal */ }
    setLoadingGroupInvitations(false);
  }

  async function respondToGroupInvitation(invitationId: number, accept: boolean) {
    const endpoint = accept ? 'accept' : 'decline';
    const res = await fetch(`/api/groups/invitations/${invitationId}/${endpoint}`, {
      method: 'POST',
      credentials: 'include',
    });
    if (res.ok) {
      setGroupInvitations(prev => prev.filter(inv => inv.id !== invitationId));
      if (accept) {
        // Refresh groups list
        const groupsRes = await fetch('/api/groups', { credentials: 'include' });
        if (groupsRes.ok) {
          const data = await groupsRes.json() as { groups: GroupSummary[] };
          setGroups(data.groups);
        }
      }
    }
  }

  // ── Accept / decline a message request (mobile + desktop shared handler) ──
  async function handleMsgRequest(reqId: number, action: 'accept' | 'decline') {
    try {
      const r = await fetch(`/api/message-requests/${reqId}/${action}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (r.ok) {
        setMsgRequests(prev => prev.filter(x => x.id !== reqId));
        if (action === 'accept') {
          // Refresh inbox so the newly-accepted conversation appears immediately
          await loadConversations(false);
        }
      }
    } catch { /* non-fatal */ }
  }

  async function blockUserFromConversation(userId: string) {
    try {
      await fetch('/api/community/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ blockedId: userId }),
      });
      // Remove conversations with this user from the list
      setConversations(prev => prev.filter(c => c.otherUser?.id !== userId));
      if (activeOtherUser?.id === userId) {
        setActiveConvId(null);
        setMobileView('list');
      }
    } catch { /* silent */ }
  }

  async function submitMessageReport() {
    if (!reportingMsgId || !reportReason) return;
    setReportSubmitting(true);
    try {
      await fetch(`/api/messages/${reportingMsgId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason: reportReason, details: reportDetails }),
      });
      setReportDone(true);
      setTimeout(() => {
        setReportingMsgId(null);
        setReportReason('');
        setReportDetails('');
        setReportDone(false);
      }, 2000);
    } finally {
      setReportSubmitting(false);
    }
  }

  async function leaveGroup(groupId: number) {
    if (!window.confirm('Leave this group? You will no longer receive messages.')) return;
    const res = await fetch(`/api/groups/${groupId}/leave`, { method: 'POST', credentials: 'include' });
    if (res.ok) {
      setGroups(prev => prev.filter(g => g.id !== groupId));
      if (activeGroupId === groupId) {
        setActiveGroupId(null);
        setGroupMessages([]);
        setGroupMembers([]);
        setMobileView('list');
      }
    }
  }

  // ── New group member search ────────────────────────────────────────────────
  useEffect(() => {
    if (!showCreateGroup) return;
    if (newGroupMemberSearch.length < 2) { setNewGroupMemberResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(newGroupMemberSearch)}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json() as { users: OtherUser[] };
          setNewGroupMemberResults(data.users.filter(u => !newGroupMemberIds.includes(u.id)));
        }
      } catch { /* non-fatal */ }
    }, 300);
    return () => clearTimeout(timer);
  }, [newGroupMemberSearch, showCreateGroup, newGroupMemberIds]);

  // ── Load group invitations when Groups tab opens ──────────────────────────
  useEffect(() => {
    if (inboxFilter === 'groups' && session) void loadGroupInvitations();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inboxFilter, session]);

  // ── Compose: search users ─────────────────────────────────────────────────
  useEffect(() => {
    if (!showCompose) return;
    if (composeQuery.length < 2) { setComposeResults([]); return; }
    const timer = setTimeout(async () => {
      setComposeSearching(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(composeQuery)}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json() as { users: OtherUser[] };
          setComposeResults(data.users);
        }
      } finally {
        setComposeSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [composeQuery, showCompose]);

  async function startConversationWith(recipient: OtherUser) {
    setComposeStarting(recipient.id);
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ recipientId: recipient.id }),
      });
      if (!res.ok) return;
      const { id } = await res.json() as { id: number };
      await loadConversations();
      void openConversation(id, recipient);
      setShowCompose(false);
      setComposeQuery('');
      setComposeResults([]);
    } finally {
      setComposeStarting(null);
    }
  }

  // ── PWA install prompt — handled by shared InstallBanner component ─────────

  async function sendTestNotification() {
    setTestNotifStatus('sending');
    try {
      const res = await fetch('/api/push/test', { method: 'POST', credentials: 'include' });
      setTestNotifStatus(res.ok ? 'sent' : 'error');
    } catch {
      setTestNotifStatus('error');
    }
    setTimeout(() => setTestNotifStatus('idle'), 4000);
  }


  // ── Presence heartbeat ────────────────────────────────────────────────────

  useEffect(() => {
    if (!myId) return;
    const ping = () => { void fetch('/api/presence', { method: 'POST', credentials: 'include' }); };
    ping();
    heartbeatRef.current = setInterval(ping, 30_000);
    return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
  }, [myId]);

  // ── Key setup ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!myId) return;
    async function setup() {
      const { publicKeyJwk } = await getOrCreateKeyPair();
      await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ publicKey: publicKeyJwk }),
      });
      setKeyReady(true);
    }
    void setup();
  }, [myId]);

  // ── Load conversations ────────────────────────────────────────────────────

  const loadConversations = useCallback(async (isInitialLoad = false) => {
    try {
      const res = await fetch('/api/conversations?limit=50', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json() as { conversations?: ConversationSummary[]; hasMore?: boolean } | ConversationSummary[];
        // Handle both plain-array and { conversations, hasMore } shapes
        const convList = Array.isArray(data) ? data : (data.conversations ?? []);
        setConversations(convList);
        setConvLoadError(false);

        // Batch-fetch presence for all other participants
        const otherIds = convList
          .map(c => c.otherUser?.id)
          .filter((id): id is string => !!id);
        const uniqueIds = [...new Set(otherIds)];
        if (uniqueIds.length > 0) {
          try {
            const presRes = await fetch('/api/presence/batch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ userIds: uniqueIds }),
            });
            if (presRes.ok) {
              const presData = await presRes.json() as { presence: Record<string, { online: boolean; lastSeen: string | null }> };
              setBatchPresence(presData.presence ?? {});
            }
          } catch { /* non-fatal — OnlineDot falls back to individual polling */ }
        }
      } else if (isInitialLoad) {
        // Only surface an error on the initial page load — background polls silently
        // retry on the next interval rather than wiping the existing conversation list.
        setConvLoadError(true);
      }
    } catch {
      if (isInitialLoad) setConvLoadError(true);
    } finally {
      setLoadingConvs(false);
    }
  }, []);

  useEffect(() => {
    if (!myId) return;
    void loadConversations(true);
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    const interval = setInterval(() => { void loadConversations(false); }, 10_000);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [myId, loadConversations]);

  // ── Handle ?with=username deep-link ──────────────────────────────────────

  useEffect(() => {
    const withUsername = searchParams.get('with');
    if (!withUsername || !myId || !keyReady) return;

    async function openOrCreate() {
      const profileRes = await fetch(`/api/profile/${withUsername}`, { credentials: 'include' });
      if (!profileRes.ok) return;
      const profile = await profileRes.json() as { id?: string };
      if (!profile.id) return;

      const convRes = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ recipientId: profile.id }),
      });
      if (!convRes.ok) return;
      const { id } = await convRes.json() as { id: number };
      await loadConversations();
      void openConversation(id, { id: profile.id, name: withUsername, image: null, username: withUsername });
    }

    void openOrCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, myId, keyReady]);

  // ── Decrypt helper ────────────────────────────────────────────────────────

  async function decryptAll(raw: Message[], theirKey: string | null): Promise<Message[]> {
    return Promise.all(raw.map(async (m) => {
      // System messages are stored as plaintext — skip decryption
      if (m.systemMessage) return { ...m, plaintext: m.systemMessage };
      // Pre-key plaintext: sender had no recipient key, stored as base64 with iv='plain'
      if (m.iv === 'plain') {
        try {
          return { ...m, plaintext: decodeURIComponent(escape(atob(m.ciphertext))) };
        } catch {
          return { ...m, plaintext: m.ciphertext };
        }
      }
      if (!theirKey) return { ...m, plaintext: '🔒 Encrypted' };
      const pt = await decryptMessage(m.ciphertext, m.iv, theirKey);
      return { ...m, plaintext: pt ?? '🔒 Encrypted' };
    }));
  }

  // ── Open a conversation ───────────────────────────────────────────────────

  async function openConversation(convId: number, other: OtherUser) {
    setActiveConvId(convId);
    setActiveOtherUser(other);
    setMobileView('thread');
    // If the other user has no username yet, try to resolve it by ID so the
    // thread header link works as soon as they set one.
    if (!other.username && other.id) {
      fetch(`/api/users/${other.id}`, { credentials: 'include' })
        .then(r => r.ok ? r.json() as Promise<{ username: string | null; name: string | null; image: string | null }> : null)
        .then(data => {
          if (data?.username) {
            setActiveOtherUser(prev => prev ? { ...prev, username: data.username } : prev);
          }
        })
        .catch(() => { /* non-fatal */ });
    }
    setLoadingMsgs(true);
    setMessages([]);
    setDraft('');
    setFolder('inbox');
    setOtherIsTyping(false);
    setLastReadMsgId(null);
    lastMsgTimestampRef.current = null;
    // Reset Phase 3 state
    setReplyTo(null);
    setEditingMsg(null);
    setReactionPickerMsgId(null);
    // Reset Phase 5 state
    setShowSearch(false);

    const [keyRes, wallpaperRes, covenRes] = await Promise.all([
      fetch(`/api/keys?userId=${other.id}`, { credentials: 'include' }),
      fetch(`/api/conversations/${convId}/wallpaper`, { credentials: 'include' }),
      fetch(`/api/coven/status/${other.id}`, { credentials: 'include' }),
    ]);
    const theirKey = keyRes.ok ? ((await keyRes.json() as { publicKey?: string }).publicKey ?? null) : null;
    setOtherUserPublicKey(theirKey);
    if (wallpaperRes.ok) {
      const wp = await wallpaperRes.json() as WallpaperPrefs;
      setWallpaper(wp);
    } else {
      setWallpaper(defaultWallpaper);
    }
    if (covenRes.ok) {
      const cs = await covenRes.json() as { status: CovenStatus; connectionId: number | null };
      setCovenStatus(cs.status);
      setCovenConnectionId(cs.connectionId);
      setIsCoven(cs.status === 'accepted');
    } else {
      setCovenStatus(null);
      setCovenConnectionId(null);
      setIsCoven(false);
    }

    await loadFolder('inbox', convId, theirKey);
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, unreadCount: 0 } : c));
    setTimeout(() => inputRef.current?.focus(), 300);
  }

  // ── Re-fetch the other user's public key (called on input focus so the UI
  //    unlocks as soon as the recipient opens Messages for the first time) ────
  async function refreshOtherUserKey() {
    if (otherUserPublicKey || !activeOtherUser) return; // already have it
    try {
      const res = await fetch(`/api/keys?userId=${activeOtherUser.id}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json() as { publicKey?: string };
        if (data.publicKey) setOtherUserPublicKey(data.publicKey);
      }
    } catch { /* non-fatal */ }
  }

  // ── Coven action handler ─────────────────────────────────────────────────
  async function handleCovenAction(action: 'send' | 'accept' | 'decline') {
    if (!activeOtherUser) return;
    if (action === 'send') {
      const res = await fetch('/api/coven/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ receiverId: activeOtherUser.id }),
      });
      if (res.ok) {
        setCovenStatus('pending_sent');
      }
    } else if ((action === 'accept' || action === 'decline') && covenConnectionId !== null) {
      const res = await fetch('/api/coven/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ connectionId: covenConnectionId, action }),
      });
      if (res.ok) {
        if (action === 'accept') {
          setCovenStatus('accepted');
          setIsCoven(true);
        } else {
          setCovenStatus('declined');
        }
      }
    }
  }

  // ── Phase 5: scroll to a message by id ───────────────────────────────────
  function scrollToMessage(messageId: number) {
    setShowSearch(false);
    // Give the panel time to close, then scroll the element into view
    setTimeout(() => {
      const el = document.getElementById(`msg-${messageId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('msg-highlight');
        setTimeout(() => el.classList.remove('msg-highlight'), 1800);
      }
    }, 120);
  }

  // ── Load folder messages ──────────────────────────────────────────────────

  async function loadFolder(f: Folder, convId: number, theirKey: string | null) {
    setLoadingMsgs(true);
    const statusParam = f === 'drafts' ? 'draft' : f === 'trash' ? 'trashed' : '';
    const url = `/api/conversations/${convId}/messages${statusParam ? `?status=${statusParam}` : ''}`;
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) { setLoadingMsgs(false); return; }
    const responseData = await res.json() as { messages?: Message[]; hasMore?: boolean; oldestId?: number | null } | Message[];
    // Handle both old array format and new { messages, hasMore, oldestId } format
    const raw = Array.isArray(responseData) ? responseData : (responseData.messages ?? []);
    const hasMore = !Array.isArray(responseData) ? (responseData.hasMore ?? false) : false;
    const oldestId = !Array.isArray(responseData) ? (responseData.oldestId ?? null) : null;
    const decrypted = await decryptAll(raw, theirKey);
    setMessages(decrypted);
    setHasMoreMessages(hasMore);
    setOldestMsgId(oldestId ?? (decrypted[0]?.id ?? null));
    // Seed the since-pointer so polling only fetches new messages
    if (decrypted.length && f === 'inbox') {
      const latest = decrypted[decrypted.length - 1];
      lastMsgTimestampRef.current = latest.createdAt;
    }
    setLoadingMsgs(false);
  }

  // ── Load older messages (pagination) ─────────────────────────────────────
  async function loadOlderMessages() {
    if (!activeConvId || !hasMoreMessages || loadingOlder || !oldestMsgId) return;
    setLoadingOlder(true);
    try {
      const url = `/api/conversations/${activeConvId}/messages?before=${oldestMsgId}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) { setLoadingOlder(false); return; }
      const responseData = await res.json() as { messages?: Message[]; hasMore?: boolean; oldestId?: number | null } | Message[];
      const raw = Array.isArray(responseData) ? responseData : (responseData.messages ?? []);
      const hasMore = !Array.isArray(responseData) ? (responseData.hasMore ?? false) : false;
      const decrypted = await decryptAll(raw, otherUserPublicKey);
      setMessages(prev => [...decrypted, ...prev]);
      setHasMoreMessages(hasMore);
      if (decrypted.length) setOldestMsgId(decrypted[0].id);
    } catch { /* non-fatal */ }
    setLoadingOlder(false);
  }

  // ── Switch folder ─────────────────────────────────────────────────────────

  async function switchFolder(f: Folder) {
    setFolder(f);
    if (activeConvId !== null) {
      await loadFolder(f, activeConvId, otherUserPublicKey);
    }
  }

  // ── Conversation-level state action (archive / star / pin / mute / delete-for-me) ──

  async function convStateAction(convId: number, patch: {
    isArchived?: boolean;
    isStarred?: boolean;
    isPinned?: boolean;
    isMuted?: boolean;
    isHidden?: boolean;
  }) {
    setConvMenuId(null);
    try {
      const res = await fetch(`/api/conversations/${convId}/state`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(patch),
      });
      if (!res.ok) return;
      // Optimistically update local state
      setConversations(prev => prev
        .map(c => c.id === convId ? { ...c, ...patch } : c)
        .filter(c => !c.isHidden) // remove delete-for-me immediately
      );
    } catch { /* non-fatal */ }
  }

  // ── SSE real-time stream ─────────────────────────────────────────────────
  // Replaces the 3 s message poll, 2 s typing poll, and 5 s read-receipt poll.
  // Falls back to the 15 s inbox poll (below) if SSE is unavailable.

  const activeConvIdRef = useRef(activeConvId);
  activeConvIdRef.current = activeConvId;
  const otherUserPublicKeyRef = useRef(otherUserPublicKey);
  otherUserPublicKeyRef.current = otherUserPublicKey;
  const activeGroupIdRef = useRef(activeGroupId);
  activeGroupIdRef.current = activeGroupId;

  useMessengerSSE({
    enabled: !!myId,
    onConnect: () => {
      setIsOffline(false);
      // Reconnected — refresh inbox and active thread to catch up on missed events
      void loadConversations(false);
      if (activeConvIdRef.current && folder === 'inbox') {
        void (async () => {
          const after = lastMsgTimestampRef.current ?? new Date(0).toISOString();
          const res = await fetch(
            `/api/conversations/${activeConvIdRef.current}/messages/since?after=${encodeURIComponent(after)}`,
            { credentials: 'include' },
          );
          if (!res.ok) return;
          const raw = await res.json() as Message[];
          if (!raw.length) return;
          const decrypted = await decryptAll(raw, otherUserPublicKeyRef.current);
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const newOnes = decrypted.filter(m => !existingIds.has(m.id));
            if (!newOnes.length) return prev;
            const merged = [...prev, ...newOnes].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            const latest = merged[merged.length - 1];
            if (latest) lastMsgTimestampRef.current = latest.createdAt;
            return merged;
          });
        })();
      }
    },
    onDisconnect: () => setIsOffline(true),
    onEvent: (event) => {
      setIsOffline(false);
      switch (event.type) {
        case 'new_message': {
          const p = event.payload;
          if (!p) break;
          // Refresh inbox list so unread counts + last-message preview update
          void loadConversations(false);
          // If the event is for the active DM thread, fetch new messages
          if (p.conversationId === activeConvIdRef.current && folder === 'inbox') {
            void (async () => {
              const after = lastMsgTimestampRef.current ?? new Date(0).toISOString();
              const res = await fetch(
                `/api/conversations/${p.conversationId}/messages/since?after=${encodeURIComponent(after)}`,
                { credentials: 'include' },
              );
              if (!res.ok) return;
              const raw = await res.json() as Message[];
              if (!raw.length) return;
              const decrypted = await decryptAll(raw, otherUserPublicKeyRef.current);
              setMessages(prev => {
                const existingIds = new Set(prev.map(m => m.id));
                const newOnes = decrypted.filter(m => !existingIds.has(m.id));
                if (!newOnes.length) return prev;
                const merged = [...prev, ...newOnes].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                const latest = merged[merged.length - 1];
                if (latest) lastMsgTimestampRef.current = latest.createdAt;
                return merged;
              });
              setConversations(prev => prev.map(c => c.id === p.conversationId ? { ...c, unreadCount: 0 } : c));
            })();
          }
          break;
        }
        case 'group_message': {
          const p = event.payload;
          if (!p?.groupId) break;
          // Refresh group messages if this group is active
          if (p.groupId === activeGroupIdRef.current) {
            void (async () => {
              const res = await fetch(`/api/groups/${p.groupId}/messages`, { credentials: 'include' });
              if (!res.ok) return;
              const data = await res.json() as { messages: GroupMessage[] };
              setGroupMessages(data.messages ?? []);
            })();
          }
          break;
        }
        case 'typing': {
          const p = event.payload;
          if (p?.conversationId === activeConvIdRef.current) {
            setOtherIsTyping(true);
            // Auto-clear after 4 s (matches server TTL)
            setTimeout(() => setOtherIsTyping(false), 4_000);
          }
          break;
        }
        case 'read_receipt': {
          const p = event.payload;
          if (p?.conversationId === activeConvIdRef.current) {
            // Refresh read receipt state
            void (async () => {
              const res = await fetch(`/api/conversations/${p.conversationId}/receipts`, { credentials: 'include' });
              if (!res.ok) return;
              const data = await res.json() as { lastReadMessageId: number | null };
              setLastReadMsgId(data.lastReadMessageId);
            })();
          }
          break;
        }
        case 'presence_update': {
          // Presence is managed by OnlineDot and batchPresence polling.
          // The SSE event just triggers a refresh of the batch presence map.
          void (async () => {
            const convIds = conversations.map(c => c.otherUser?.id).filter(Boolean);
            if (!convIds.length) return;
            const res = await fetch('/api/presence/batch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ userIds: convIds }),
            });
            if (!res.ok) return;
            const data = await res.json() as { presence: typeof batchPresence };
            setBatchPresence(data.presence);
          })();
          break;
        }
        case 'request_update':
          void loadConversations(false);
          break;
        default:
          break;
      }
    },
  });

  // ── Fallback: poll for new messages every 15 s (SSE gap coverage) ─────────
  // Kept as a safety net; SSE handles the fast path above.

  useEffect(() => {
    if (!activeConvId || folder !== 'inbox') return;
    const poll = async () => {
      const after = lastMsgTimestampRef.current ?? new Date(0).toISOString();
      const res = await fetch(`/api/conversations/${activeConvId}/messages/since?after=${encodeURIComponent(after)}`, { credentials: 'include' });
      if (!res.ok) return;
      const raw = await res.json() as Message[];
      if (!raw.length) return;
      const decrypted = await decryptAll(raw, otherUserPublicKey);
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const newOnes = decrypted.filter(m => !existingIds.has(m.id));
        if (!newOnes.length) return prev;
        const merged = [...prev, ...newOnes].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const latest = merged[merged.length - 1];
        if (latest) lastMsgTimestampRef.current = latest.createdAt;
        return merged;
      });
      setConversations(prev => prev.map(c => c.id === activeConvId ? { ...c, unreadCount: 0 } : c));
    };
    const interval = setInterval(() => { void poll(); }, 15_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConvId, otherUserPublicKey, folder]);

  // ── Fallback: poll typing indicator every 4 s (SSE gap coverage) ──────────

  useEffect(() => {
    if (!activeConvId || folder !== 'inbox') return;
    const poll = async () => {
      const res = await fetch(`/api/conversations/${activeConvId}/typing`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json() as { typing: boolean };
      setOtherIsTyping(data.typing);
    };
    const interval = setInterval(() => { void poll(); }, 4_000);
    return () => clearInterval(interval);
  }, [activeConvId, folder]);

  // ── Fallback: poll read receipts every 10 s (SSE gap coverage) ───────────

  useEffect(() => {
    if (!activeConvId || folder !== 'inbox') return;
    const poll = async () => {
      const res = await fetch(`/api/conversations/${activeConvId}/receipts`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json() as { lastReadMessageId: number | null };
      setLastReadMsgId(data.lastReadMessageId);
    };
    void poll(); // immediate on open
    const interval = setInterval(() => { void poll(); }, 10_000);
    return () => clearInterval(interval);
  }, [activeConvId, folder]);

  // ── Scroll to bottom on new messages ─────────────────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // ── Auto-save draft after 2s of inactivity ───────────────────────────────

  useEffect(() => {
    if (!draft.trim() || !activeConvId || !otherUserPublicKey) return;
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => { void saveDraft(); }, 2000);
    return () => { if (draftTimerRef.current) clearTimeout(draftTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  // ── Typing signal: debounced POST when draft changes ─────────────────────

  useEffect(() => {
    if (!draft.trim() || !activeConvId || folder !== 'inbox') return;
    // Fire immediately, then debounce further signals
    void fetch(`/api/conversations/${activeConvId}/typing`, { method: 'POST', credentials: 'include' });
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    typingDebounceRef.current = setTimeout(() => {
      // No further action needed — server TTL handles expiry
    }, 3000);
    return () => { if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  // ── Save draft ────────────────────────────────────────────────────────────

  async function saveDraft() {
    if (!draft.trim() || !activeConvId || !otherUserPublicKey) return;
    const { ciphertext, iv } = await encryptMessage(draft.trim(), otherUserPublicKey);
    await fetch(`/api/conversations/${activeConvId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ciphertext, iv, status: 'draft' }),
    });
  }

  // ── Send message ──────────────────────────────────────────────────────────

  async function handleSend() {
    // If in edit mode, submit the edit instead
    if (editingMsg) { await submitEdit(); return; }
    if (!draft.trim() || !activeConvId || sending) return;
    setSending(true);
    setSendError(null);
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    const replyToId = replyTo?.id ?? undefined;
    // Generate a per-send idempotency key to prevent duplicate messages on retry
    const idempotencyKey = `${myId}-${activeConvId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      // If the recipient hasn't set up their key yet, send as plaintext (base64-encoded, iv='plain')
      // Once both parties have keys, messages are fully encrypted.
      const { ciphertext, iv } = otherUserPublicKey
        ? await encryptMessage(draft.trim(), otherUserPublicKey)
        : { ciphertext: btoa(unescape(encodeURIComponent(draft.trim()))), iv: 'plain' };
      const res = await fetch(`/api/conversations/${activeConvId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ciphertext, iv, idempotencyKey, ...(replyToId ? { replyToId } : {}) }),
      });
      if (res.ok) {
        const { id } = await res.json() as { id: number };
        const text = draft.trim();
        setDraft('');
        setReplyTo(null);
        setSendError(null);
        setMessages(prev => [...prev, {
          id,
          conversationId: activeConvId,
          senderId: myId,
          ciphertext,
          iv,
          status: 'sent',
          readAt: null,
          createdAt: new Date().toISOString(),
          plaintext: text,
          replyToId: replyToId ?? null,
          reactions: [],
        }]);
        void loadConversations();
      } else {
        const errData = await res.json().catch(() => ({})) as { error?: string };
        setSendError(errData.error ?? 'Message could not be sent. Please try again.');
      }
    } finally {
      setSending(false);
    }
  }

  // ── Message actions ───────────────────────────────────────────────────────

  async function updateMessageStatus(msgId: number, status: MessageStatus) {
    setOpenMenuId(null);
    const res = await fetch(`/api/messages/${msgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setMessages(prev => prev.filter(m => m.id !== msgId));
    }
  }

  async function softDeleteMessage(msgId: number) {
    setOpenMenuId(null);
    const res = await fetch(`/api/messages/${msgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ softDelete: true }),
    });
    if (res.ok) {
      setMessages(prev => prev.map(m => m.id === msgId
        ? { ...m, deletedAt: new Date().toISOString(), plaintext: undefined, ciphertext: '', iv: '' }
        : m));
    }
  }

  // Delete for self — removes from local view only (no server call; message stays for recipient)
  function deleteForSelf(msgId: number) {
    setMessages(prev => prev.filter(m => m.id !== msgId));
    setOpenMenuId(null);
  }

  async function deleteConversation() {
    if (!activeConvId) return;
    const res = await fetch(`/api/conversations/${activeConvId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) {
      setConversations(prev => prev.filter(c => c.id !== activeConvId));
      setActiveConvId(null);
      setMessages([]);
      setMobileView('list');
    }
  }

  async function submitEdit() {
    if (!editingMsg || !draft.trim() || !otherUserPublicKey) return;
    const { ciphertext, iv } = await encryptMessage(draft.trim(), otherUserPublicKey);
    const res = await fetch(`/api/messages/${editingMsg.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ciphertext, iv }),
    });
    if (res.ok) {
      setMessages(prev => prev.map(m => m.id === editingMsg.id
        ? { ...m, plaintext: draft.trim(), editedAt: new Date().toISOString() }
        : m));
      setEditingMsg(null);
      setDraft('');
    }
  }

  async function toggleReaction(msgId: number, emoji: string) {
    setReactionPickerMsgId(null);
    const res = await fetch(`/api/messages/${msgId}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ emoji }),
    });
    if (!res.ok) return;
    const data = await res.json() as { action: 'added' | 'removed'; emoji: string };
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      const existing = m.reactions ?? [];
      if (data.action === 'added') {
        const idx = existing.findIndex(r => r.emoji === emoji);
        if (idx >= 0) {
          const updated = [...existing];
          updated[idx] = { ...updated[idx], count: updated[idx].count + 1, userIds: [...updated[idx].userIds, myId] };
          return { ...m, reactions: updated };
        }
        return { ...m, reactions: [...existing, { emoji, count: 1, userIds: [myId] }] };
      } else {
        return { ...m, reactions: existing.map(r => r.emoji === emoji
          ? { ...r, count: r.count - 1, userIds: r.userIds.filter(id => id !== myId) }
          : r).filter(r => r.count > 0) };
      }
    }));
  }

  // ── Auth guard ────────────────────────────────────────────────────────────

  if (!isPending && !session) {
    return (
      <main className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <MessageCircle className="w-12 h-12 mx-auto" style={{ color: 'hsl(var(--muted-foreground))' }} />
          <p style={{ color: 'hsl(var(--muted-foreground))' }}>{pageContent.signInPrompt}</p>
          <Button onClick={() => navigate('/login')} className="bg-primary text-primary-foreground">
            {pageContent.signInButton}
          </Button>
        </div>
      </main>
    );
  }

  const totalUnread = (Array.isArray(conversations) ? conversations : []).reduce((n, c) => n + c.unreadCount, 0);

  // ── Render ────────────────────────────────────────────────────────────────

  const filteredConversations = conversations.filter(conv => {
    const matchesSearch = !inboxSearch || (
      (conv.otherUser?.name ?? '').toLowerCase().includes(inboxSearch.toLowerCase()) ||
      (conv.otherUser?.username ?? '').toLowerCase().includes(inboxSearch.toLowerCase())
    );
    // Always show the currently-open conversation regardless of filter —
    // marking messages as read drops unreadCount to 0, which would otherwise hide
    // the active thread and make it appear messages vanished.
    let matchesFilter: boolean;
    if (inboxFilter === 'all') {
      // 'all' hides archived conversations unless they're the active one
      matchesFilter = !conv.isArchived || conv.id === activeConvId;
    } else if (inboxFilter === 'unread') {
      matchesFilter = (conv.unreadCount > 0 && !conv.isArchived) || conv.id === activeConvId;
    } else if (inboxFilter === 'archived') {
      matchesFilter = Boolean(conv.isArchived) || conv.id === activeConvId;
    } else if (inboxFilter === 'groups') {
      // Groups tab: show nothing from DM list (groups come from separate state)
      matchesFilter = false;
    } else if (inboxFilter === 'requests') {
      // Requests tab: show nothing from DM list (requests come from separate state)
      matchesFilter = false;
    } else {
      // 'read'
      matchesFilter = (conv.unreadCount === 0 && !conv.isArchived) || conv.id === activeConvId;
    }
    return matchesSearch && matchesFilter;
  });

  return (
    <>
      <Helmet>
        <title>{pageContent.title} — Spellful</title>
        <meta name="description" content="Private encrypted messages between Spellful members." />
        <meta name="robots" content="noindex" />
      </Helmet>

      {/* Horoscope popup removed — now shown as inline strip in sidebar */}

      {/* Messaging privacy settings modal */}
      <MessagingPrivacyModal open={showPrivacySettings} onClose={() => setShowPrivacySettings(false)} />

      {/* ── Mobile: full-screen native-feel stack ── Desktop: two-panel card ── */}
      <div className="md:max-w-5xl md:mx-auto md:px-4 md:py-8">

        {/* ════════════════════════════════════════════════
            MOBILE CONVERSATION LIST
        ════════════════════════════════════════════════ */}
        <div className={`flex flex-col md:hidden ${mobileView === 'thread' ? 'hidden' : ''}`}
          style={{ minHeight: 'calc(100dvh - 4rem)' }}>

          {/* List header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <div>
              <h1 className="font-serif text-2xl font-bold" style={{ color: 'hsl(var(--foreground))' }}>
                Messages
                {totalUnread > 0 && (
                  <span className="ml-2 text-xs font-sans px-2 py-0.5 rounded-full align-middle"
                    style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                    {totalUnread}
                  </span>
                )}
              </h1>
              <div className="flex items-center gap-1 mt-0.5">
                <ShieldCheck className="w-3 h-3" style={{ color: 'hsl(var(--success))' }} />
                <span className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Private conversation</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPrivacySettings(true)}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90"
                style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))', border: '1px solid hsl(var(--border))' }}
                aria-label="Messaging privacy settings">
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setShowCompose(v => !v); setComposeQuery(''); setComposeResults([]); }}
                className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-90"
                style={{
                  background: showCompose ? 'hsl(var(--muted))' : 'hsl(var(--primary))',
                  color: showCompose ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary-foreground))',
                  border: showCompose ? '1px solid hsl(var(--border))' : 'none',
                }}
                aria-label={showCompose ? 'Cancel' : 'New message'}>
                {showCompose ? <XIcon className="w-4 h-4" /> : <PenSquare className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="px-4 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'hsl(var(--muted-foreground))' }} />
              <input
                type="search"
                value={inboxSearch}
                onChange={e => setInboxSearch(e.target.value)}
                placeholder="Search conversations…"
                className="w-full pl-9 pr-4 py-2.5 text-sm rounded-2xl outline-none transition-colors"
                style={{
                  background: 'hsl(var(--muted))',
                  color: 'hsl(var(--foreground))',
                  border: '1px solid hsl(var(--border))',
                }}
              />
              {inboxSearch && (
                <button
                  onClick={() => setInboxSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center"
                  aria-label="Clear search">
                  <XIcon className="w-3.5 h-3.5" style={{ color: 'hsl(var(--muted-foreground))' }} />
                </button>
              )}
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 px-4 pb-2 overflow-x-auto scrollbar-none">
            {([
              { id: 'all' as const, label: 'All' },
              { id: 'unread' as const, label: totalUnread > 0 ? `Unread (${totalUnread})` : 'Unread' },
              { id: 'requests' as const, label: msgRequests.length > 0 ? `Requests (${msgRequests.length})` : 'Requests' },
              { id: 'groups' as const, label: 'Groups' },
              { id: 'archived' as const, label: 'Archived' },
            ] as { id: 'all' | 'unread' | 'read' | 'requests' | 'groups' | 'archived'; label: string }[]).map(f => (
              <button
                key={f.id}
                onClick={() => setInboxFilter(f.id)}
                className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                style={{
                  background: inboxFilter === f.id ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                  color: inboxFilter === f.id ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
                  border: inboxFilter === f.id ? 'none' : '1px solid hsl(var(--border))',
                }}>
                {f.label}
              </button>
            ))}
          </div>

          {/* ── Active Now strip ── */}
          {inboxFilter === 'all' && (
            <ActiveNowStrip
              users={conversations
                .filter(c => c.otherUser && batchPresence[c.otherUser.id]?.online)
                .map(c => c.otherUser!)
                .filter((u, i, arr) => arr.findIndex(x => x.id === u.id) === i)}
              onStartConversation={u => void startConversationWith(u)}
            />
          )}

          {/* ── Mobile requests panel ── */}
          {inboxFilter === 'requests' && (
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                These members want to message you. Accept to move them to your inbox, or decline to remove the request.
              </p>
              {!msgRequestsLoaded ? (
                <button
                  className="text-xs underline"
                  style={{ color: 'hsl(var(--primary))' }}
                  onClick={() => {
                    setMsgRequestsLoaded(true);
                    fetch('/api/message-requests', { credentials: 'include' })
                      .then(r => r.ok ? r.json() : null)
                      .then((d: { requests?: MsgRequest[] } | null) => { if (d?.requests) setMsgRequests(d.requests); })
                      .catch(() => undefined);
                  }}>
                  Load requests
                </button>
              ) : msgRequests.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <MessageCircle className="w-10 h-10 opacity-20" style={{ color: 'hsl(var(--muted-foreground))' }} />
                  <p className="text-sm font-medium" style={{ color: 'hsl(var(--foreground))' }}>No pending requests</p>
                  <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>New message requests will appear here</p>
                </div>
              ) : (
                msgRequests.map(req => (
                  <div key={req.id} className="flex items-center gap-3 p-3 rounded-2xl"
                    style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))' }}>
                    <Avatar user={{ id: req.requesterId, name: req.requesterName, username: req.requesterUsername, image: req.requesterImage }} size={44} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'hsl(var(--foreground))' }}>
                        {req.requesterName ?? req.requesterUsername ?? 'Unknown'}
                      </p>
                      {req.requesterUsername && (
                        <p className="text-xs truncate" style={{ color: 'hsl(var(--muted-foreground))' }}>@{req.requesterUsername}</p>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="default"
                        onClick={() => void handleMsgRequest(req.id, 'accept')}
                        className="text-xs h-8 px-3 rounded-full">
                        Accept
                      </Button>
                      <Button size="sm" variant="outline"
                        onClick={() => void handleMsgRequest(req.id, 'decline')}
                        className="text-xs h-8 px-3 rounded-full">
                        Decline
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── Inline compose panel (mobile) ── */}
          <AnimatePresence>
            {showCompose && (
              <motion.div
                key="inline-compose-mobile"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden mx-4 mb-2 rounded-2xl"
                style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold" style={{ color: 'hsl(var(--foreground))' }}>New Message</p>
                    <button
                      onClick={() => setShowCompose(false)}
                      className="w-7 h-7 rounded-full flex items-center justify-center"
                      style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}
                      aria-label="Close">
                      <XIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                      style={{ color: 'hsl(var(--muted-foreground))' }} />
                    <input
                      autoFocus
                      type="text"
                      placeholder="Search by name or @username…"
                      value={composeQuery}
                      onChange={e => setComposeQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
                      style={{
                        background: 'hsl(var(--muted))',
                        border: '1px solid hsl(var(--border))',
                        color: 'hsl(var(--foreground))',
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-1 max-h-56 overflow-y-auto">
                    {composeSearching && (
                      <p className="text-sm text-center py-3" style={{ color: 'hsl(var(--muted-foreground))' }}>Searching…</p>
                    )}
                    {!composeSearching && composeQuery.length >= 2 && composeResults.length === 0 && (
                      <p className="text-sm text-center py-3" style={{ color: 'hsl(var(--muted-foreground))' }}>No members found</p>
                    )}
                    {!composeSearching && composeQuery.length < 2 && (
                      <p className="text-sm text-center py-3" style={{ color: 'hsl(var(--muted-foreground))' }}>Type 2+ characters to search</p>
                    )}
                    {composeResults.map(u => (
                      <button
                        key={u.id}
                        onClick={() => void startConversationWith(u)}
                        disabled={composeStarting === u.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors"
                        style={{ opacity: composeStarting === u.id ? 0.6 : 1 }}>
                        <Avatar user={u} size={36} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: 'hsl(var(--foreground))' }}>
                            {u.name ?? u.username ?? 'Unknown'}
                          </p>
                          {u.username && (
                            <p className="text-xs truncate" style={{ color: 'hsl(var(--muted-foreground))' }}>@{u.username}</p>
                          )}
                        </div>
                        {composeStarting === u.id ? (
                          <span className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Opening…</span>
                        ) : (
                          <Send className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'hsl(var(--primary))' }} />
                        )}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => { setShowCompose(false); navigate('/community/discover'); }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-opacity hover:opacity-80"
                    style={{ color: 'hsl(var(--muted-foreground))' }}>
                    <Users className="w-4 h-4" />
                    Browse member directory
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Conversation rows */}
          <div className="flex-1 overflow-y-auto">
            {loadingConvs ? (
              <div className="flex flex-col gap-0 px-0 pt-2">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="flex items-center gap-3.5 px-5 py-3.5 animate-pulse"
                    style={{ borderBottom: '1px solid hsl(var(--border) / 0.4)' }}>
                    <div className="w-13 h-13 rounded-full flex-shrink-0" style={{ width: 52, height: 52, background: 'hsl(var(--muted))' }} />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 rounded-full w-1/3" style={{ background: 'hsl(var(--muted))' }} />
                      <div className="h-2.5 rounded-full w-2/3" style={{ background: 'hsl(var(--muted))' }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : convLoadError ? (
              <div className="flex flex-col items-center justify-center gap-4 px-8 pt-16 text-center">
                <div className="w-20 h-20 rounded-full flex items-center justify-center"
                  style={{ background: 'hsl(var(--muted))' }}>
                  <MessageCircle className="w-9 h-9" style={{ color: 'hsl(var(--destructive))' }} />
                </div>
                <p className="font-serif text-lg" style={{ color: 'hsl(var(--foreground))' }}>Couldn't load messages</p>
                <p className="text-sm leading-relaxed" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  There was a problem retrieving your conversations. Your messages are safe — please try again.
                </p>
                <button
                  onClick={() => { setConvLoadError(false); setLoadingConvs(true); void loadConversations(true); }}
                  className="mt-2 px-6 py-2.5 rounded-full text-sm font-medium transition-opacity active:opacity-70"
                  style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                  Try again
                </button>
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-5 px-8 pt-12 pb-8 text-center">
                {/* Celestial illustration */}
                <div className="relative w-28 h-28 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full opacity-20"
                    style={{ background: 'radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)' }} />
                  <svg viewBox="0 0 80 80" className="w-20 h-20" aria-hidden="true">
                    <circle cx="40" cy="40" r="18" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.6" />
                    <circle cx="40" cy="40" r="10" fill="hsl(var(--primary))" opacity="0.3" />
                    <circle cx="40" cy="40" r="5" fill="hsl(var(--primary))" opacity="0.7" />
                    {[0,45,90,135,180,225,270,315].map((deg, i) => {
                      const rad = (deg * Math.PI) / 180;
                      const x = 40 + 28 * Math.cos(rad);
                      const y = 40 + 28 * Math.sin(rad);
                      return <circle key={i} cx={x} cy={y} r="1.5" fill="hsl(var(--accent))" opacity="0.8" />;
                    })}
                    <path d="M40 10 L42 18 L40 16 L38 18 Z" fill="hsl(var(--primary))" opacity="0.5" />
                    <path d="M70 40 L62 42 L64 40 L62 38 Z" fill="hsl(var(--accent))" opacity="0.5" />
                  </svg>
                </div>
                <div className="space-y-2">
                  <p className="font-serif text-xl" style={{ color: 'hsl(var(--foreground))' }}>
                    Every connection begins with a little magic.
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: 'hsl(var(--muted-foreground))' }}>
                    Your messages are private and encrypted. Start a conversation with a fellow member.
                  </p>
                </div>
                <div className="flex flex-col gap-2 w-full max-w-xs">
                  <button
                    onClick={() => { setShowCompose(true); setComposeQuery(''); setComposeResults([]); }}
                    className="w-full py-2.5 rounded-full text-sm font-medium transition-opacity active:opacity-70"
                    style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                    Start a Conversation
                  </button>
                  <button
                    onClick={() => navigate('/community/discover')}
                    className="w-full py-2.5 rounded-full text-sm font-medium transition-opacity active:opacity-70"
                    style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))' }}>
                    Discover Members
                  </button>
                  <button
                    onClick={() => navigate('/account/privacy')}
                    className="text-xs mt-1 transition-opacity hover:opacity-70"
                    style={{ color: 'hsl(var(--muted-foreground))' }}>
                    Manage privacy settings
                  </button>
                </div>
              </div>
            ) : isOffline ? (
              <div className="flex flex-col items-center justify-center gap-4 px-8 pt-16 text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: 'hsl(var(--muted))' }}>
                  <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"
                    style={{ color: 'hsl(var(--muted-foreground))' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M8.111 8.111A5.5 5.5 0 0112 7c1.657 0 3.156.733 4.172 1.899M15.536 15.536A5.5 5.5 0 0112 17a5.5 5.5 0 01-3.536-1.464M1.5 1.5l21 21" />
                  </svg>
                </div>
                <p className="font-serif text-lg" style={{ color: 'hsl(var(--foreground))' }}>You're offline</p>
                <p className="text-sm leading-relaxed" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  Your messages are safe. Check your connection and we'll reconnect automatically.
                </p>
                <button
                  onClick={() => { if (navigator.onLine) { setIsOffline(false); setConvLoadError(false); setLoadingConvs(true); void loadConversations(true); } }}
                  className="mt-1 px-6 py-2.5 rounded-full text-sm font-medium transition-opacity active:opacity-70"
                  style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))' }}>
                  Check connection
                </button>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 px-8 text-center gap-3">
                {inboxSearch ? (
                  <>
                    <svg viewBox="0 0 24 24" className="w-10 h-10 opacity-25" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"
                      style={{ color: 'hsl(var(--muted-foreground))' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0015.803 15.803z" />
                    </svg>
                    <p className="text-sm font-medium" style={{ color: 'hsl(var(--foreground))' }}>No results for "{inboxSearch}"</p>
                    <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Try a different name or username</p>
                    <button onClick={() => setInboxSearch('')} className="text-xs underline mt-1" style={{ color: 'hsl(var(--primary))' }}>
                      Clear search
                    </button>
                  </>
                ) : inboxFilter === 'unread' ? (
                  <>
                    <svg viewBox="0 0 24 24" className="w-10 h-10 opacity-25" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"
                      style={{ color: 'hsl(var(--primary))' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm font-medium" style={{ color: 'hsl(var(--foreground))' }}>All caught up ✨</p>
                    <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>No unread messages right now</p>
                    <button onClick={() => setInboxFilter('all')} className="text-xs underline mt-1" style={{ color: 'hsl(var(--primary))' }}>
                      View all conversations
                    </button>
                  </>
                ) : inboxFilter === 'archived' ? (
                  <>
                    <svg viewBox="0 0 24 24" className="w-10 h-10 opacity-25" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"
                      style={{ color: 'hsl(var(--muted-foreground))' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                    </svg>
                    <p className="text-sm font-medium" style={{ color: 'hsl(var(--foreground))' }}>No archived conversations</p>
                    <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Archived chats will appear here</p>
                    <button onClick={() => setInboxFilter('all')} className="text-xs underline mt-1" style={{ color: 'hsl(var(--primary))' }}>
                      Back to inbox
                    </button>
                  </>
                ) : inboxFilter === 'groups' ? (
                  <>
                    <svg viewBox="0 0 24 24" className="w-10 h-10 opacity-25" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"
                      style={{ color: 'hsl(var(--muted-foreground))' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                    </svg>
                    <p className="text-sm font-medium" style={{ color: 'hsl(var(--foreground))' }}>No group chats yet</p>
                    <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Create a group to chat with multiple members</p>
                    <button onClick={() => setInboxFilter('all')} className="text-xs underline mt-1" style={{ color: 'hsl(var(--primary))' }}>
                      Back to inbox
                    </button>
                  </>
                ) : (
                  <>
                    <MessageCircle className="w-10 h-10 opacity-25" style={{ color: 'hsl(var(--muted-foreground))' }} />
                    <p className="text-sm font-medium" style={{ color: 'hsl(var(--foreground))' }}>No conversations here</p>
                    <button onClick={() => setInboxFilter('all')} className="text-xs underline mt-1" style={{ color: 'hsl(var(--primary))' }}>
                      Back to inbox
                    </button>
                  </>
                )}
              </div>
            ) : (
              filteredConversations.map((conv, idx) => (
                <React.Fragment key={conv.id}>
                  {/* Pinned section header */}
                  {idx === 0 && conv.isPinned && (
                    <div className="px-5 pt-3 pb-1">
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'hsl(var(--muted-foreground))' }}>Pinned</p>
                    </div>
                  )}
                  {/* Section break between pinned and unpinned */}
                  {idx > 0 && filteredConversations[idx - 1].isPinned && !conv.isPinned && (
                    <div className="px-5 pt-3 pb-1">
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'hsl(var(--muted-foreground))' }}>Messages</p>
                    </div>
                  )}
                  <div className="relative group" style={{ borderBottom: '1px solid hsl(var(--border) / 0.5)' }}>
                    <motion.button
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    onClick={() => conv.otherUser && void openConversation(conv.id, conv.otherUser)}
                    onContextMenu={(e) => { e.preventDefault(); setConvMenuId(convMenuId === conv.id ? null : conv.id); }}
                    className="w-full flex items-center gap-3.5 px-5 py-4 text-left active:opacity-60 transition-opacity">
                    <span className="relative flex-shrink-0">
                      <Avatar user={conv.otherUser} size={52} />
                      {conv.otherUser && (
                        <div className="absolute bottom-0 right-0">
                          <OnlineDot userId={conv.otherUser.id} size={12} presenceData={batchPresence[conv.otherUser.id] ?? null} />
                        </div>
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={'text-sm truncate ' + (conv.unreadCount > 0 ? 'font-semibold' : 'font-medium')}
                          style={{ color: 'hsl(var(--foreground))' }}>
                          {conv.otherUser?.name ?? conv.otherUser?.username ?? 'Unknown'}
                          {conv.isCoven && <span className="ml-1 text-xs" title="Coven friend">🔮</span>}
                          {conv.isMuted && <span className="ml-1 text-xs opacity-60">🔇</span>}
                        </span>
                        {conv.lastMessage && (
                          <span className={'text-xs flex-shrink-0 ' + (conv.unreadCount > 0 ? 'font-semibold' : '')}
                            style={{ color: conv.unreadCount > 0 ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }}>
                            {formatTime(conv.lastMessage.createdAt)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-0.5 gap-2">
                        <span className={'text-xs truncate ' + (conv.unreadCount > 0 ? 'font-medium' : '')}
                          style={{ color: conv.unreadCount > 0 ? 'hsl(var(--foreground) / 0.85)' : 'hsl(var(--muted-foreground))' }}>
                          {conv.lastMessage
                            ? conv.lastMessage.systemMessage
                              ? richCardPreview(conv.lastMessage.systemMessage)
                              : conv.lastMessage.senderId === session?.user?.id
                                ? 'You: Encrypted message'
                                : 'Encrypted message'
                            : 'No messages yet'}
                        </span>
                        <span className="flex items-center gap-1 flex-shrink-0">
                          {conv.isStarred && <span className="text-xs">⭐</span>}
                          {conv.unreadCount > 0 ? (
                            <span className="text-xs min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center font-semibold"
                              style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                              {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                            </span>
                          ) : conv.lastMessage?.senderId === session?.user?.id ? (
                            <span className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>✓✓</span>
                          ) : null}
                        </span>
                      </div>
                    </div>
                    {/* Context menu trigger — visible on hover */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setConvMenuId(convMenuId === conv.id ? null : conv.id); }}
                      className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: 'hsl(var(--muted-foreground))' }}
                      aria-label="Conversation options">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </motion.button>
                  {/* Conversation context menu */}
                  {convMenuId === conv.id && (
                    <>
                      <div className="fixed inset-0 z-20" onClick={() => setConvMenuId(null)} />
                      <div
                        className="absolute right-3 top-12 z-30 rounded-2xl shadow-xl py-1 min-w-[190px]"
                        style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                        onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => void convStateAction(conv.id, { isPinned: !conv.isPinned })}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs hover:opacity-80 text-left"
                          style={{ color: 'hsl(var(--foreground))' }}>
                          📌 {conv.isPinned ? 'Unpin' : 'Pin conversation'}
                        </button>
                        <button onClick={() => void convStateAction(conv.id, { isStarred: !conv.isStarred })}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs hover:opacity-80 text-left"
                          style={{ color: 'hsl(var(--foreground))' }}>
                          ⭐ {conv.isStarred ? 'Unstar' : 'Star conversation'}
                        </button>
                        <button onClick={() => void convStateAction(conv.id, { isArchived: !conv.isArchived })}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs hover:opacity-80 text-left"
                          style={{ color: 'hsl(var(--foreground))' }}>
                          📁 {conv.isArchived ? 'Unarchive' : 'Archive'}
                        </button>
                        <button onClick={() => void convStateAction(conv.id, { isMuted: !conv.isMuted })}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs hover:opacity-80 text-left"
                          style={{ color: 'hsl(var(--foreground))' }}>
                          🔇 {conv.isMuted ? 'Unmute' : 'Mute notifications'}
                        </button>
                        <div style={{ borderTop: '1px solid hsl(var(--border))' }} className="my-1" />
                        {conv.otherUser && (
                          <button onClick={() => { setConvMenuId(null); void blockUserFromConversation(conv.otherUser!.id); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs hover:opacity-80 text-left"
                            style={{ color: 'hsl(var(--destructive))' }}>
                            🚫 Block member
                          </button>
                        )}
                        <button onClick={() => void convStateAction(conv.id, { isHidden: true })}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs hover:opacity-80 text-left"
                          style={{ color: 'hsl(var(--destructive))' }}>
                          🗑 Delete for me
                        </button>
                      </div>
                    </>
                  )}
                  </div>
                </React.Fragment>
              ))
            )}
            {/* ── Groups action bar ── */}
            {inboxFilter === 'groups' && (
              <div className="flex items-center justify-between px-5 py-2.5" style={{ borderBottom: '1px solid hsl(var(--border) / 0.5)' }}>
                <button
                  onClick={() => { setShowGroupInvitations(true); void loadGroupInvitations(); }}
                  className="flex items-center gap-1.5 text-xs font-medium transition-opacity active:opacity-70"
                  style={{ color: 'hsl(var(--muted-foreground))' }}>
                  <UserCheck className="w-3.5 h-3.5" />
                  Invitations
                  {groupInvitations.length > 0 && (
                    <span className="ml-0.5 w-4 h-4 rounded-full text-xs flex items-center justify-center font-semibold"
                      style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                      {groupInvitations.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setShowCreateGroup(true)}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-opacity active:opacity-70"
                  style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                  <Users className="w-3 h-3" />
                  New Group
                </button>
              </div>
            )}
            {/* ── Groups list (shown when Groups tab is active) ── */}
            {inboxFilter === 'groups' && (
              loadingGroups ? (
                <div className="flex flex-col gap-0">
                  {[0,1,2].map(i => (
                    <div key={i} className="flex items-center gap-3.5 px-5 py-3.5 animate-pulse"
                      style={{ borderBottom: '1px solid hsl(var(--border) / 0.4)' }}>
                      <div className="w-13 h-13 rounded-full flex-shrink-0" style={{ width: 52, height: 52, background: 'hsl(var(--muted))' }} />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 rounded-full w-1/3" style={{ background: 'hsl(var(--muted))' }} />
                        <div className="h-2.5 rounded-full w-2/3" style={{ background: 'hsl(var(--muted))' }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : groups.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-4 px-8 pt-12 pb-8 text-center">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center"
                    style={{ background: 'hsl(var(--muted))' }}>
                    <Users className="w-7 h-7" style={{ color: 'hsl(var(--primary))' }} />
                  </div>
                  <p className="font-serif text-lg" style={{ color: 'hsl(var(--foreground))' }}>No group chats yet</p>
                  <p className="text-sm leading-relaxed" style={{ color: 'hsl(var(--muted-foreground))' }}>
                    Create a group to chat with multiple members at once.
                  </p>
                  <button
                    onClick={() => setShowCreateGroup(true)}
                    className="mt-1 px-6 py-2.5 rounded-full text-sm font-medium transition-opacity active:opacity-70"
                    style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                    Create a Group
                  </button>
                </div>
              ) : (
                groups.map((group, idx) => (
                  <motion.button
                    key={group.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    onClick={() => void openGroupThread(group.id)}
                    className="w-full flex items-center gap-3.5 px-5 py-4 text-left active:opacity-60 transition-opacity"
                    style={{ borderBottom: '1px solid hsl(var(--border) / 0.5)', background: activeGroupId === group.id ? 'hsl(var(--muted) / 0.5)' : 'transparent' }}>
                    <span className="relative flex-shrink-0">
                      <div className="rounded-full flex items-center justify-center"
                        style={{ width: 52, height: 52, background: 'linear-gradient(135deg, hsl(var(--accent)) 0%, hsl(var(--primary)) 100%)', border: '2px solid hsl(var(--border))' }}>
                        {group.avatarUrl ? (
                          <img src={group.avatarUrl} alt={group.name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <Users className="w-5 h-5" style={{ color: 'hsl(var(--primary-foreground))' }} />
                        )}
                      </div>
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={'text-sm font-semibold truncate ' + (group.unreadCount > 0 ? 'font-bold' : '')}
                          style={{ color: 'hsl(var(--foreground))' }}>
                          {group.name}
                        </span>
                        <span className="text-xs flex-shrink-0" style={{ color: 'hsl(var(--muted-foreground))' }}>
                          {group.memberCount} members
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5 gap-2">
                        <span className="text-xs truncate" style={{ color: 'hsl(var(--muted-foreground))' }}>
                          {group.lastMessage?.content ?? 'No messages yet'}
                        </span>
                        {group.unreadCount > 0 && (
                          <span className="text-xs min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center font-semibold flex-shrink-0"
                            style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                            {group.unreadCount > 9 ? '9+' : group.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.button>
                ))
              )
            )}
          </div>

          {/* Install banner — shared component */}
          <div className="mx-4 mb-2">
            <InstallBanner />
          </div>

          {/* Test notification button — shown when notifications are granted */}
          {isInstalled && typeof Notification !== 'undefined' && Notification.permission === 'granted' && (
            <div className="px-4 pb-2">
              <button
                onClick={() => void sendTestNotification()}
                disabled={testNotifStatus === 'sending'}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-medium transition-opacity active:opacity-70 disabled:opacity-50"
                style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))', border: '1px solid hsl(var(--border))' }}>
                {testNotifStatus === 'sending' && '⏳ Sending…'}
                {testNotifStatus === 'sent' && '✅ Alert sent — check your notifications!'}
                {testNotifStatus === 'error' && '❌ Failed — make sure you\'re subscribed'}
                {testNotifStatus === 'idle' && '🔔 Test push notification'}
              </button>
            </div>
          )}

          {/* Bottom bar — quick actions */}
          <div className="flex items-center justify-between px-5 py-3"
            style={{ borderTop: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}>
            <button
              onClick={() => navigate('/community/discover')}
              className="flex items-center gap-1.5 text-xs transition-opacity active:opacity-70"
              style={{ color: 'hsl(var(--muted-foreground))' }}>
              <Users className="w-3.5 h-3.5" />
              Discover members
            </button>
            <button
              onClick={() => setShowPrivacySettings(true)}
              className="flex items-center gap-1.5 text-xs transition-opacity active:opacity-70"
              style={{ color: 'hsl(var(--muted-foreground))' }}>
              <ShieldCheck className="w-3.5 h-3.5" />
              Privacy
            </button>
            <button
              onClick={() => setShowBlockedMembers(true)}
              className="flex items-center gap-1.5 text-xs transition-opacity active:opacity-70"
              style={{ color: 'hsl(var(--muted-foreground))' }}>
              <ShieldOff className="w-3.5 h-3.5" />
              Blocked
            </button>
          </div>
        </div>

        {/* ════════════════════════════════════════════════
            MOBILE THREAD VIEW (full-screen slide-in)
        ════════════════════════════════════════════════ */}
        <AnimatePresence>
          {mobileView === 'thread' && activeGroupId && (
            <motion.div
              key="group-thread"
              className="spellful-mobile-thread md:hidden fixed inset-0 flex flex-col overflow-hidden"
              style={{ background: 'hsl(var(--background))', zIndex: 60 }}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] as const }}>
              <GroupThreadView
                group={groups.find(g => g.id === activeGroupId) ?? null}
                messages={groupMessages}
                members={groupMembers}
                loading={loadingGroupMsgs}
                myId={myId}
                draft={groupDraft}
                setDraft={setGroupDraft}
                sending={sendingGroup}
                sendError={groupSendError}
                onSend={() => void sendGroupMessage()}
                onLeave={() => void leaveGroup(activeGroupId)}
                onClose={() => { setActiveGroupId(null); setGroupMessages([]); setGroupMembers([]); setMobileView('list'); }}
                mobile
              />
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {mobileView === 'thread' && !activeGroupId && (
            <motion.div
              key="thread"
              className="spellful-mobile-thread md:hidden fixed inset-0 flex flex-col overflow-hidden"
              style={{ background: 'hsl(var(--background))', zIndex: 60 }}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] as const }}>

              {/* Thread top bar */}
              <div className="flex-shrink-0 flex items-center gap-2 px-4 pb-3"
                style={{
                  paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
                  borderBottom: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--card))',
                }}>
                <button
                  onClick={() => setMobileView('list')}
                  className="flex items-center gap-0.5 -ml-1 py-1 pr-2 rounded-lg active:opacity-60 transition-opacity"
                  aria-label="Back">
                  <ArrowLeft className="w-5 h-5" style={{ color: 'hsl(var(--primary))' }} />
                  <span className="text-sm font-medium" style={{ color: 'hsl(var(--primary))' }}>Back</span>
                </button>
                <button
                  type="button"
                  onClick={() => { if (activeOtherUser?.username) navigate(`/u/${activeOtherUser.username}`); }}
                  className="flex-1 flex flex-col items-center gap-0.5 cursor-pointer disabled:cursor-default"
                  disabled={!activeOtherUser?.username}
                  aria-label={activeOtherUser?.username ? `View ${activeOtherUser.name ?? activeOtherUser.username}'s profile` : undefined}>
                  <span className="relative">
                    <Avatar user={activeOtherUser} size={32} />
                    {activeOtherUser && (
                      <span className="absolute -bottom-0.5 -right-0.5">
                        <OnlineDot userId={activeOtherUser.id} size={9} presenceData={batchPresence[activeOtherUser.id] ?? null} />
                      </span>
                    )}
                  </span>
                  <p className="text-sm font-semibold leading-tight hover:underline" style={{ color: 'hsl(var(--foreground))' }}>
                    {activeOtherUser?.name ?? activeOtherUser?.username ?? 'Unknown'}
                  </p>
                  <AnimatePresence mode="wait">
                    {otherIsTyping ? (
                      <motion.p key="typing-m" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="text-xs leading-tight" style={{ color: 'hsl(var(--primary))' }}>
                        typing…
                      </motion.p>
                    ) : activeOtherUser?.username ? (
                      <motion.p key="username-m" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="text-xs leading-tight" style={{ color: 'hsl(var(--muted-foreground))' }}>
                        @{activeOtherUser.username}
                      </motion.p>
                    ) : null}
                  </AnimatePresence>
                </button>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowSearch(v => !v)}
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{
                      background: showSearch ? 'hsl(var(--primary) / 0.15)' : 'hsl(var(--muted))',
                      color: showSearch ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                    }}
                    aria-label="Search messages">
                    <Search className="w-4 h-4" />
                  </button>
                  {isCoven && (
                    <button
                      onClick={() => setShowWallpaperMobile(v => !v)}
                      className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                      style={{
                        background: showWallpaperMobile ? 'hsl(var(--primary) / 0.15)' : 'hsl(var(--muted))',
                        color: showWallpaperMobile ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                      }}
                      aria-label="Chat appearance">
                      <Palette className="w-4 h-4" />
                    </button>
                  )}
                  <Lock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'hsl(var(--success))' }} />
                  <button
                    onClick={() => {
                      if (window.confirm('Delete this conversation? This cannot be undone.')) {
                        void deleteConversation();
                      }
                    }}
                    className="w-8 h-8 rounded-full flex items-center justify-center ml-1"
                    style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--destructive))' }}
                    aria-label="Delete conversation">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* ── Phase 5: Mobile search panel ── */}
              <AnimatePresence>
                {showSearch && (
                  <MessengerSearchPanel
                    messages={messages}
                    myId={myId}
                    otherUserName={activeOtherUser?.name ?? activeOtherUser?.username ?? 'Them'}
                    onClose={() => setShowSearch(false)}
                    onJumpTo={scrollToMessage}
                  />
                )}
              </AnimatePresence>

              {/* ── Mobile inline wallpaper panel ── */}
              <AnimatePresence>
                {showWallpaperMobile && activeConvId !== null && (
                  <motion.div
                    key="wallpaper-mobile-inline"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                    style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                    <MessengerWallpaperPicker
                      conversationId={activeConvId}
                      current={wallpaper}
                      onClose={() => setShowWallpaperMobile(false)}
                      onSave={(prefs) => { setWallpaper(prefs); setShowWallpaperMobile(false); void fetch(`/api/conversations/${activeConvId}/wallpaper`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(prefs) }); }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Folder tabs */}
              <div className="flex-shrink-0 flex items-center gap-1 px-2 pt-2 pb-0 overflow-x-auto scrollbar-none"
                style={{ borderBottom: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}>
                {([
                  { id: 'inbox', label: 'Inbox', icon: Inbox },
                  { id: 'requests', label: 'Requests', icon: UserCheck },
                  { id: 'drafts', label: 'Drafts', icon: FileText },
                  { id: 'trash', label: 'Trash', icon: Trash2 },
                ] as { id: Folder; label: string; icon: LucideIcon }[]).map(tab => (
                  <button key={tab.id} onClick={() => void switchFolder(tab.id)}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-t-lg transition-colors flex-shrink-0"
                    style={{
                      color: folder === tab.id ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                      borderBottom: folder === tab.id ? '2px solid hsl(var(--primary))' : '2px solid transparent',
                    }}>
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Messages scroll area */}
              <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-2 relative" onClick={() => setOpenMenuId(null)}>
                {/* Wallpaper background */}
                {(() => {
                  const theme = MESSENGER_THEMES.find(t => t.id === wallpaper.themeId);
                  const bgStyle: React.CSSProperties = wallpaper.themeId === 'custom' && wallpaper.customImageUrl
                    ? { backgroundImage: `url(${wallpaper.customImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'local' }
                    : theme?.backgroundStyle
                      ? { background: theme.backgroundStyle }
                      : {};
                  return Object.keys(bgStyle).length > 0 ? (
                    <>
                      <div className="absolute inset-0 pointer-events-none" style={{
                        ...bgStyle,
                        ...(wallpaper.blurAmount > 0 ? { filter: `blur(${wallpaper.blurAmount}px)`, transform: 'scale(1.05)' } : {}),
                      }} />
                      {wallpaper.dimAmount > 0 && (
                        <div className="absolute inset-0 pointer-events-none"
                          style={{ background: `hsl(var(--background) / ${wallpaper.dimAmount / 100})` }} />
                      )}
                    </>
                  ) : null;
                })()}
                <div className="flex items-center justify-center gap-1.5 py-1 mb-1">
                  {folder === 'inbox' && (
                    <><Lock className="w-3 h-3" style={{ color: 'hsl(var(--success))' }} />
                    <span className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Private conversation</span></>
                  )}
                  {folder === 'requests' && (
                    <><UserCheck className="w-3 h-3" style={{ color: 'hsl(var(--primary))' }} />
                    <span className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Message requests — review before accepting</span></>
                  )}
                  {folder === 'drafts' && (
                    <><FileText className="w-3 h-3" style={{ color: 'hsl(var(--muted-foreground))' }} />
                    <span className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Drafts — only visible to you</span></>
                  )}
                  {folder === 'trash' && (
                    <><Trash2 className="w-3 h-3" style={{ color: 'hsl(var(--muted-foreground))' }} />
                    <span className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Trash — only visible to you</span></>
                  )}
                </div>

                {/* Load older messages — mobile */}
                {hasMoreMessages && !loadingMsgs && (
                  <div className="flex justify-center pt-2 pb-1">
                    <button
                      onClick={() => void loadOlderMessages()}
                      disabled={loadingOlder}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-opacity active:opacity-70 disabled:opacity-50"
                      style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))', border: '1px solid hsl(var(--border))' }}>
                      {loadingOlder ? (
                        <><span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin inline-block" />Loading…</>
                      ) : (
                        <>↑ Load older</>
                      )}
                    </button>
                  </div>
                )}
                {loadingMsgs ? (
                  <div className="flex flex-col gap-3 pt-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'} animate-pulse`}>
                        <div className="h-10 rounded-3xl" style={{ width: `${40 + i * 15}%`, background: 'hsl(var(--muted))' }} />
                      </div>
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 pt-12 text-center">
                    <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
                      {folder === 'drafts' ? 'No drafts.' : folder === 'trash' ? 'Trash is empty.' : pageContent.emptyMessages}
                    </p>
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {messages.map((msg, idx) => {
                      const isMine = msg.senderId === myId;
                      const isSystem = !!msg.systemMessage;
                      const isRich = isRichCard(msg.systemMessage);
                      const prevMsgM: Message | undefined = idx > 0 ? messages[idx - 1] : undefined;
                      const showDateSepM = !prevMsgM || new Date(msg.createdAt).toDateString() !== new Date(prevMsgM.createdAt).toDateString();
                      const isLastMineM = isMine && !isSystem && messages.slice(idx + 1).every(m => m.senderId !== myId || !!m.systemMessage);
                      return (
                        <React.Fragment key={msg.id}>
                          {showDateSepM && (
                            <div className="flex items-center gap-3 py-2">
                              <div className="flex-1 h-px" style={{ background: 'hsl(var(--border))' }} />
                              <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: 'hsl(var(--muted-foreground))', background: 'hsl(var(--muted))' }}>{formatDateLabel(msg.createdAt)}</span>
                              <div className="flex-1 h-px" style={{ background: 'hsl(var(--border))' }} />
                            </div>
                          )}
                          <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.18 }}
                            id={`msg-${msg.id}`}
                            className={'flex ' + (isMine ? 'justify-end' : 'justify-start')}>
                            <div className={isSystem ? 'w-full' : 'min-w-0 max-w-[78%] [overflow-wrap:anywhere]'} style={{ marginLeft: isSystem ? 'auto' : undefined, marginRight: isSystem ? 'auto' : undefined }}>
                            <div className="relative group">
                              {isRich && msg.systemMessage ? (
                                <RichMessageCard systemMessage={msg.systemMessage} isMine={isMine} />
                              ) : isSystem ? (
                                <div className="rounded-2xl overflow-hidden"
                                  style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
                                  <img
                                    src="/airo-assets/images/logo/official-white"
                                    alt="Welcome to Spellful"
                                    className="w-full object-cover"
                                    style={{ maxHeight: 160 }}
                                    loading="eager"
                                  />
                                  <div className="px-4 py-3 text-sm whitespace-pre-line"
                                    style={{ color: 'hsl(var(--foreground))', lineHeight: 1.7, fontFamily: 'var(--font-sans)' }}>
                                    {msg.plaintext}
                                  </div>
                                  <div className="px-4 pb-3 text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                                    {formatTime(msg.createdAt)}
                                  </div>
                                </div>
                              ) : (
                              <div>
                                {/* Reply-to quote */}
                                {msg.replyToId && (() => {
                                  const quoted = messages.find(m => m.id === msg.replyToId);
                                  return quoted ? (
                                    <div className="mb-1 px-3 py-1.5 rounded-xl text-xs opacity-70 border-l-2"
                                      style={{
                                        background: isMine ? 'hsl(var(--primary) / 0.3)' : 'hsl(var(--card))',
                                        borderLeftColor: 'hsl(var(--accent))',
                                        color: isMine ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
                                      }}>
                                      <span className="font-medium mr-1">{quoted.senderId === myId ? 'You' : 'Them'}:</span>
                                      <span className="line-clamp-1">{quoted.deletedAt ? 'Message deleted' : (quoted.plaintext ?? '🔒')}</span>
                                    </div>
                                  ) : null;
                                })()}
                                {/* Bubble */}
                                <div className="px-4 py-2.5 text-sm leading-relaxed"
                                  style={{
                                    background: msg.deletedAt ? 'transparent' : msg.status === 'draft' ? 'hsl(var(--muted))' : isMine ? 'hsl(var(--primary))' : 'hsl(var(--card))',
                                    color: msg.deletedAt ? 'hsl(var(--muted-foreground))' : msg.status === 'draft' ? 'hsl(var(--muted-foreground))' : isMine ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
                                    borderRadius: isMine ? '20px 20px 5px 20px' : '20px 20px 20px 5px',
                                    opacity: msg.status === 'draft' ? 0.8 : 1,
                                    border: msg.deletedAt ? '1px dashed hsl(var(--border))' : msg.status === 'draft' ? '1px dashed hsl(var(--border))' : isMine ? 'none' : '1px solid hsl(var(--border))',
                                    boxShadow: msg.deletedAt ? 'none' : '0 1px 4px hsl(var(--background) / 0.4)',
                                    fontStyle: msg.deletedAt ? 'italic' : undefined,
                                  }}>
                                  {msg.deletedAt ? 'Message deleted' : (msg.plaintext ?? '🔒 Encrypted')}
                                  {msg.status === 'draft' && !msg.deletedAt && (
                                    <span className="ml-2 text-xs italic" style={{ color: 'hsl(var(--muted-foreground))' }}>Draft</span>
                                  )}
                                </div>
                              </div>
                              )}
                              {/* Long-press / hover action row */}
                              {!isSystem && !msg.deletedAt && (
                                <div className={'absolute -top-8 flex items-center gap-1 ' + (isMine ? 'right-0' : 'left-0') + ' opacity-0 group-hover:opacity-100 transition-opacity z-10'}>
                                  {/* Reaction picker */}
                                  <div className="relative">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setReactionPickerMsgId(reactionPickerMsgId === msg.id ? null : msg.id); }}
                                      className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
                                      style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                                      aria-label="React">
                                      😊
                                    </button>
                                    <AnimatePresence>
                                      {reactionPickerMsgId === msg.id && (
                                        <motion.div
                                          initial={{ opacity: 0, scale: 0.85 }}
                                          animate={{ opacity: 1, scale: 1 }}
                                          exit={{ opacity: 0, scale: 0.85 }}
                                          className={'absolute bottom-9 flex gap-1 px-2 py-1.5 rounded-2xl shadow-xl z-30 ' + (isMine ? 'right-0' : 'left-0')}
                                          style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                                          onClick={e => e.stopPropagation()}>
                                          {['👍', '❤️', '✨', '🌙', '🔮', '🕯️', '🌿', '⚡'].map(emoji => {
                                            const myReaction = msg.reactions?.find(r => r.emoji === emoji && r.userIds.includes(myId));
                                            return (
                                              <button key={emoji} onClick={() => void toggleReaction(msg.id, emoji)}
                                                className="text-lg w-8 h-8 flex items-center justify-center rounded-full"
                                                style={{ background: myReaction ? 'hsl(var(--primary) / 0.2)' : 'transparent' }}
                                                aria-label={emoji}>
                                                {emoji}
                                              </button>
                                            );
                                          })}
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>
                                  {/* Reply */}
                                  <button
                                    onClick={() => { setReplyTo(msg); setReactionPickerMsgId(null); }}
                                    className="w-7 h-7 rounded-full flex items-center justify-center"
                                    style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}
                                    aria-label="Reply">
                                    <CornerUpLeft className="w-3.5 h-3.5" />
                                  </button>
                                  {/* Menu (own messages) */}
                                  {isMine && (
                                    <div className="relative">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === msg.id ? null : msg.id); }}
                                        className="w-7 h-7 rounded-full flex items-center justify-center"
                                        style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}
                                        aria-label="Message options">
                                        <MoreVertical className="w-3.5 h-3.5" />
                                      </button>
                                      {openMenuId === msg.id && (
                                        <div className={'absolute bottom-9 z-20 rounded-2xl shadow-xl py-1 min-w-[160px] ' + (isMine ? 'right-0' : 'left-0')}
                                          style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                                          onClick={e => e.stopPropagation()}>
                                          {msg.status === 'sent' && (
                                            <button onClick={() => { setEditingMsg(msg); setDraft(msg.plaintext ?? ''); setOpenMenuId(null); }}
                                              className="w-full flex items-center gap-2 px-4 py-2.5 text-xs hover:opacity-80"
                                              style={{ color: 'hsl(var(--foreground))' }}>
                                              <Pencil className="w-3.5 h-3.5" />Edit
                                            </button>
                                          )}
                                          {msg.status === 'draft' && (
                                            <button onClick={() => void updateMessageStatus(msg.id, 'sent')}
                                              className="w-full flex items-center gap-2 px-4 py-2.5 text-xs hover:opacity-80"
                                              style={{ color: 'hsl(var(--success))' }}>
                                              <Send className="w-3.5 h-3.5" />Send now
                                            </button>
                                          )}
                                          {msg.status === 'trashed' && (
                                            <button onClick={() => void updateMessageStatus(msg.id, 'sent')}
                                              className="w-full flex items-center gap-2 px-4 py-2.5 text-xs hover:opacity-80"
                                              style={{ color: 'hsl(var(--foreground))' }}>
                                              <RotateCcw className="w-3.5 h-3.5" />Restore
                                            </button>
                                          )}
                                          {msg.status !== 'trashed' && (
                                            <button onClick={() => void updateMessageStatus(msg.id, 'trashed')}
                                              className="w-full flex items-center gap-2 px-4 py-2.5 text-xs hover:opacity-80"
                                              style={{ color: 'hsl(var(--warning))' }}>
                                              <Trash2 className="w-3.5 h-3.5" />Move to trash
                                            </button>
                                          )}
                                          <button onClick={() => { deleteForSelf(msg.id); setOpenMenuId(null); }}
                                            className="w-full flex items-center gap-2 px-4 py-2.5 text-xs hover:opacity-80"
                                            style={{ color: 'hsl(var(--muted-foreground))' }}>
                                            <Trash2 className="w-3.5 h-3.5" />Delete for me
                                          </button>
                                          <button onClick={() => void softDeleteMessage(msg.id)}
                                            className="w-full flex items-center gap-2 px-4 py-2.5 text-xs hover:opacity-80"
                                            style={{ color: 'hsl(var(--destructive))' }}>
                                            <Trash2 className="w-3.5 h-3.5" />Delete for everyone
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            {/* Reactions row */}
                            {!isSystem && (msg.reactions?.length ?? 0) > 0 && (
                              <div className={'flex flex-wrap gap-1 mt-1 ' + (isMine ? 'justify-end' : 'justify-start')}>
                                {(msg.reactions ?? []).map(r => (
                                  <button key={r.emoji} onClick={() => void toggleReaction(msg.id, r.emoji)}
                                    className="flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs"
                                    style={{
                                      background: r.userIds.includes(myId) ? 'hsl(var(--primary) / 0.2)' : 'hsl(var(--muted))',
                                      border: r.userIds.includes(myId) ? '1px solid hsl(var(--primary) / 0.4)' : '1px solid hsl(var(--border))',
                                      color: 'hsl(var(--foreground))',
                                    }}>
                                    <span>{r.emoji}</span>
                                    <span style={{ color: 'hsl(var(--muted-foreground))' }}>{r.count}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                            {!isSystem && (
                            <div className={'flex items-center gap-1.5 text-xs px-1 ' + (isMine ? 'justify-end' : 'justify-start')}
                              style={{ color: 'hsl(var(--muted-foreground))' }}>
                              {formatTime(msg.createdAt)}
                              {msg.editedAt && !msg.deletedAt && <span className="italic">· edited</span>}
                              {isMine && isLastMineM && (
                                <span className="flex items-center gap-0.5">
                                  {(lastReadMsgId !== null && msg.id <= lastReadMsgId) || msg.readAt
                                    ? <><CheckCheck className="w-3 h-3" style={{ color: 'hsl(var(--success))' }} /><span style={{ color: 'hsl(var(--success))' }}>Read</span></>
                                    : <><Check className="w-3 h-3" /><span>Sent</span></>
                                  }
                                </span>
                              )}
                            </div>
                            )}
                          </div>
                          </motion.div>
                        </React.Fragment>
                      );
                    })}
                    {otherIsTyping && (
                      <motion.div
                        key="typing-mobile"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        className="flex justify-start">
                        <div className="flex items-center gap-2 px-4 py-2.5 rounded-[20px_20px_20px_5px]"
                          style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', maxWidth: '80px' }}>
                          <span className="flex gap-1">
                            {[0, 1, 2].map(i => (
                              <span key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
                                style={{ background: 'hsl(var(--muted-foreground))', animationDelay: i * 0.15 + 's' }} />
                            ))}
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
                {/* Coven accepted notification */}
                {covenStatus === 'accepted' && messages.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-1 py-6 px-4 text-center">
                    <span className="text-2xl">✨</span>
                    <p className="text-sm font-medium" style={{ color: 'hsl(var(--primary))' }}>
                      You're now Coven friends with {activeOtherUser?.name ?? activeOtherUser?.username ?? 'them'}!
                    </p>
                    <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Send your first message.</p>
                  </motion.div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Coven connection banner — shown when not yet accepted friends */}
              {folder === 'inbox' && covenStatus !== 'accepted' && (
                <div className="px-4 py-3 flex flex-col gap-2"
                  style={{ borderTop: '1px solid hsl(var(--border))', background: 'hsl(var(--muted))' }}>
                  {covenStatus === null && (
                    <>
                      <p className="text-xs text-center" style={{ color: 'hsl(var(--muted-foreground))' }}>
                        You're not Coven friends yet. Send a request to unlock full messaging.
                      </p>
                      <button
                        onClick={() => void handleCovenAction('send')}
                        className="w-full py-2 rounded-full text-sm font-medium transition-opacity hover:opacity-80"
                        style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                        Send Coven Request
                      </button>
                    </>
                  )}
                  {covenStatus === 'pending_sent' && (
                    <p className="text-xs text-center py-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
                      ✨ Coven request sent — waiting for {activeOtherUser?.name ?? activeOtherUser?.username ?? 'them'} to accept.
                    </p>
                  )}
                  {covenStatus === 'pending_received' && (
                    <>
                      <p className="text-xs text-center" style={{ color: 'hsl(var(--muted-foreground))' }}>
                        {activeOtherUser?.name ?? activeOtherUser?.username ?? 'They'} sent you a Coven request.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => void handleCovenAction('accept')}
                          className="flex-1 py-2 rounded-full text-sm font-medium transition-opacity hover:opacity-80"
                          style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                          Accept
                        </button>
                        <button
                          onClick={() => void handleCovenAction('decline')}
                          className="flex-1 py-2 rounded-full text-sm font-medium transition-opacity hover:opacity-80"
                          style={{ background: 'hsl(var(--muted-foreground) / 0.2)', color: 'hsl(var(--foreground))' }}>
                          Decline
                        </button>
                      </div>
                    </>
                  )}
                  {covenStatus === 'declined' && (
                    <p className="text-xs text-center py-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
                      Coven request was declined.
                    </p>
                  )}
                </div>
              )}

              {/* Sticky input bar — always shown in inbox regardless of Coven status */}
              {folder === 'inbox' && (
                <div className="flex-shrink-0 px-4 pt-3"
                  style={{
                    borderTop: '1px solid hsl(var(--border))',
                    background: 'hsl(var(--card))',
                    paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
                  }}>
                  <>
                      {/* Reply/edit context bar */}
                      <AnimatePresence>
                        {replyTo && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-xl"
                            style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))' }}>
                            <CornerUpLeft className="w-3 h-3 flex-shrink-0" style={{ color: 'hsl(var(--accent))' }} />
                            <span className="text-xs flex-1 truncate" style={{ color: 'hsl(var(--muted-foreground))' }}>
                              <span className="font-medium" style={{ color: 'hsl(var(--foreground))' }}>
                                {replyTo.senderId === myId ? 'You' : (activeOtherUser?.name ?? 'Them')}:
                              </span>{' '}{replyTo.plaintext ?? '🔒'}
                            </span>
                            <button onClick={() => setReplyTo(null)} aria-label="Cancel reply"
                              style={{ color: 'hsl(var(--muted-foreground))' }}>
                              <XIcon className="w-3.5 h-3.5" />
                            </button>
                          </motion.div>
                        )}
                        {editingMsg && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-xl"
                            style={{ background: 'hsl(var(--primary) / 0.1)', border: '1px solid hsl(var(--primary) / 0.3)' }}>
                            <Pencil className="w-3 h-3 flex-shrink-0" style={{ color: 'hsl(var(--primary))' }} />
                            <span className="text-xs flex-1" style={{ color: 'hsl(var(--primary))' }}>Editing message</span>
                            <button onClick={() => { setEditingMsg(null); setDraft(''); }} aria-label="Cancel edit"
                              style={{ color: 'hsl(var(--primary))' }}>
                              <XIcon className="w-3.5 h-3.5" />
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <form onSubmit={(e) => { e.preventDefault(); void handleSend(); }}
                        className="flex items-center gap-2">
                        <input
                          ref={inputRef}
                          value={draft}
                          onChange={e => setDraft(e.target.value)}
                          onFocus={() => void refreshOtherUserKey()}
                          placeholder={editingMsg ? 'Edit your message…' : 'Message…'}
                          className="min-w-0 flex-1 rounded-full px-4 py-2.5 text-base outline-none"
                          style={{
                            background: 'hsl(var(--muted))',
                            border: '1px solid hsl(var(--border))',
                            color: 'hsl(var(--foreground))',
                          }}
                          maxLength={2000}
                          autoComplete="off"
                        />
                        <motion.button
                          type="submit"
                          disabled={!draft.trim() || sending}
                          whileTap={{ scale: 0.88 }}
                          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-opacity"
                          style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                          {editingMsg ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                        </motion.button>
                      </form>
                      {!otherUserPublicKey && (
                        <p className="text-xs text-center px-2 mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
                          Message will send now — encryption activates once they open Messages.
                        </p>
                      )}
                      {sendError && (
                        <p className="text-xs text-center px-2 mt-1" style={{ color: 'hsl(var(--destructive))' }}>{sendError}</p>
                      )}

                    </>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ════════════════════════════════════════════════
            DESKTOP TWO-PANEL LAYOUT
        ════════════════════════════════════════════════ */}
        <div className="hidden md:flex rounded-2xl overflow-hidden"
          style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', minHeight: 560 }}>

          {/* Desktop sidebar */}
          <div className="w-72 flex-shrink-0 flex flex-col" style={{ borderRight: '1px solid hsl(var(--border))' }}>
            <div className="flex items-center justify-between px-4 py-3.5"
              style={{ borderBottom: '1px solid hsl(var(--border))' }}>
              <div>
                <p className="font-serif text-base font-semibold" style={{ color: 'hsl(var(--foreground))' }}>
                  Messages
                  {totalUnread > 0 && (
                    <span className="ml-2 text-xs font-sans px-1.5 py-0.5 rounded-full"
                      style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                      {totalUnread}
                    </span>
                  )}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <ShieldCheck className="w-3 h-3" style={{ color: 'hsl(var(--success))' }} />
                  <span className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Encrypted</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setShowPrivacySettings(true)}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:opacity-80"
                  style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))', border: '1px solid hsl(var(--border))' }}
                  aria-label="Messaging privacy settings">
                  <Settings className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => { setShowCompose(v => !v); setComposeQuery(''); setComposeResults([]); }}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:opacity-80"
                  style={{
                    background: showCompose ? 'hsl(var(--muted))' : 'hsl(var(--primary))',
                    color: showCompose ? 'hsl(var(--muted-foreground))' : 'hsl(var(--primary-foreground))',
                    border: showCompose ? '1px solid hsl(var(--border))' : 'none',
                  }}
                  aria-label={showCompose ? 'Cancel' : 'New message'}>
                  {showCompose ? <XIcon className="w-3.5 h-3.5" /> : <PenSquare className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* ── Inline compose panel (desktop) ── */}
            <AnimatePresence>
              {showCompose && (
                <motion.div
                  key="inline-compose-desktop"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                  style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                  <div className="p-3 space-y-2">
                    <p className="text-xs font-medium px-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
                      New direct message
                    </p>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                        style={{ color: 'hsl(var(--muted-foreground))' }} />
                      <input
                        autoFocus
                        type="text"
                        placeholder="Search by name or @username…"
                        value={composeQuery}
                        onChange={e => setComposeQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 rounded-xl text-xs outline-none"
                        style={{
                          background: 'hsl(var(--muted))',
                          border: '1px solid hsl(var(--border))',
                          color: 'hsl(var(--foreground))',
                        }}
                      />
                    </div>
                    <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto">
                      {composeSearching && (
                        <p className="text-xs text-center py-3" style={{ color: 'hsl(var(--muted-foreground))' }}>Searching…</p>
                      )}
                      {!composeSearching && composeQuery.length >= 2 && composeResults.length === 0 && (
                        <p className="text-xs text-center py-3" style={{ color: 'hsl(var(--muted-foreground))' }}>No members found</p>
                      )}
                      {!composeSearching && composeQuery.length < 2 && (
                        <p className="text-xs text-center py-3" style={{ color: 'hsl(var(--muted-foreground))' }}>Type 2+ characters to search</p>
                      )}
                      {composeResults.map(u => (
                        <button
                          key={u.id}
                          onClick={() => void startConversationWith(u)}
                          disabled={composeStarting === u.id}
                          className="flex items-center gap-2.5 px-2 py-2 rounded-xl text-left transition-colors"
                          style={{ opacity: composeStarting === u.id ? 0.6 : 1, background: 'transparent' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--muted))')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <Avatar user={u} size={30} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate" style={{ color: 'hsl(var(--foreground))' }}>
                              {u.name ?? u.username ?? 'Unknown'}
                            </p>
                            {u.username && (
                              <p className="text-xs truncate" style={{ color: 'hsl(var(--muted-foreground))' }}>@{u.username}</p>
                            )}
                          </div>
                          {composeStarting === u.id ? (
                            <span className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>…</span>
                          ) : (
                            <Send className="w-3 h-3 flex-shrink-0" style={{ color: 'hsl(var(--primary))' }} />
                          )}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => { setShowCompose(false); navigate('/community/discover'); }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-xs transition-opacity hover:opacity-80"
                      style={{ color: 'hsl(var(--muted-foreground))' }}>
                      <Users className="w-3.5 h-3.5" />
                      Browse member directory
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Desktop sidebar folder tabs ── */}
            <div className="flex items-center gap-0 px-3 pt-2 pb-0"
              style={{ borderBottom: '1px solid hsl(var(--border))' }}>
              {([
                { id: 'inbox' as Folder, label: 'Chats' },
                { id: 'requests' as Folder, label: 'Requests', badge: msgRequests.length },
                { id: 'drafts' as Folder, label: 'More' },
              ]).map(tab => (
                <button key={tab.id} onClick={() => void switchFolder(tab.id)}
                  className="flex items-center gap-1 px-3 py-2 text-xs font-medium transition-colors relative"
                  style={{
                    color: folder === tab.id ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                    borderBottom: folder === tab.id ? '2px solid hsl(var(--primary))' : '2px solid transparent',
                  }}>
                  {tab.label}
                  {tab.badge != null && tab.badge > 0 && (
                    <span className="w-4 h-4 rounded-full text-xs flex items-center justify-center"
                      style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                      {tab.badge > 9 ? '9+' : tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Horoscope strip removed — per inbox redesign spec */}

            <div className="flex-1 overflow-y-auto">
              {/* Message Requests panel */}
              {folder === 'requests' && (
                <div className="p-4 space-y-3">
                  <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                    These members want to message you. Accept to move them to your inbox, or decline to remove the request.
                  </p>
                  {!msgRequestsLoaded ? (
                    <button
                      className="text-xs underline"
                      style={{ color: 'hsl(var(--primary))' }}
                      onClick={() => {
                        setMsgRequestsLoaded(true);
                        fetch('/api/message-requests', { credentials: 'include' })
                          .then(r => r.ok ? r.json() : null)
                          .then((d: { requests?: MsgRequest[] } | null) => { if (d?.requests) setMsgRequests(d.requests); })
                          .catch(() => undefined);
                      }}
                    >
                      Load requests
                    </button>
                  ) : msgRequests.length === 0 ? (
                    <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>No pending message requests.</p>
                  ) : (
                    msgRequests.map(req => (
                      <div key={req.id} className="flex items-center gap-3 p-3 rounded-xl"
                        style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
                        <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center"
                          style={{ background: 'hsl(var(--muted))' }}>
                          {req.requesterImage ? (
                            <img src={req.requesterImage} alt={req.requesterName ?? ''} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-sm font-semibold" style={{ color: 'hsl(var(--muted-foreground))' }}>
                              {(req.requesterName ?? req.requesterUsername ?? '?')[0].toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: 'hsl(var(--foreground))' }}>
                            {req.requesterName ?? req.requesterUsername ?? 'Unknown member'}
                          </p>
                          {req.requesterUsername && (
                            <p className="text-xs truncate" style={{ color: 'hsl(var(--muted-foreground))' }}>@{req.requesterUsername}</p>
                          )}
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <Button size="sm" disabled={requestActionId === req.id}
                            className="h-7 text-xs"
                            style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
                            onClick={async () => {
                              setRequestActionId(req.id);
                              try { await handleMsgRequest(req.id, 'accept'); }
                              finally { setRequestActionId(null); }
                            }}>
                            Accept
                          </Button>
                          <Button size="sm" variant="ghost" disabled={requestActionId === req.id}
                            className="h-7 text-xs"
                            onClick={async () => {
                              setRequestActionId(req.id);
                              try { await handleMsgRequest(req.id, 'decline'); }
                              finally { setRequestActionId(null); }
                            }}>
                            Decline
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {folder !== 'requests' && loadingConvs ? (
                /* Desktop loading skeleton */
                <div className="flex flex-col gap-0 pt-1">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse"
                      style={{ borderBottom: '1px solid hsl(var(--border) / 0.4)' }}>
                      <div className="rounded-full flex-shrink-0" style={{ width: 40, height: 40, background: 'hsl(var(--muted))' }} />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-2.5 rounded-full w-2/5" style={{ background: 'hsl(var(--muted))' }} />
                        <div className="h-2 rounded-full w-3/5" style={{ background: 'hsl(var(--muted))' }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : folder !== 'requests' && isOffline ? (
                /* Desktop offline */
                <div className="flex flex-col items-center justify-center gap-3 px-5 py-12 text-center">
                  <svg viewBox="0 0 24 24" className="w-8 h-8 opacity-30" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"
                    style={{ color: 'hsl(var(--muted-foreground))' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M8.111 8.111A5.5 5.5 0 0112 7c1.657 0 3.156.733 4.172 1.899M15.536 15.536A5.5 5.5 0 0112 17a5.5 5.5 0 01-3.536-1.464" />
                  </svg>
                  <p className="text-sm font-medium" style={{ color: 'hsl(var(--foreground))' }}>You're offline</p>
                  <p className="text-xs leading-relaxed" style={{ color: 'hsl(var(--muted-foreground))' }}>
                    Check your connection — we'll reconnect automatically.
                  </p>
                  <button
                    onClick={() => { if (navigator.onLine) { setIsOffline(false); setConvLoadError(false); setLoadingConvs(true); void loadConversations(true); } }}
                    className="text-xs underline mt-1"
                    style={{ color: 'hsl(var(--primary))' }}>
                    Check connection
                  </button>
                </div>
              ) : folder !== 'requests' && convLoadError ? (
                /* Desktop error */
                <div className="flex flex-col items-center justify-center gap-3 px-5 py-12 text-center">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ background: 'hsl(var(--destructive) / 0.1)' }}>
                    <MessageCircle className="w-5 h-5" style={{ color: 'hsl(var(--destructive))' }} />
                  </div>
                  <p className="text-sm font-medium" style={{ color: 'hsl(var(--foreground))' }}>Couldn't load messages</p>
                  <p className="text-xs leading-relaxed" style={{ color: 'hsl(var(--muted-foreground))' }}>
                    Your messages are safe. Please try again.
                  </p>
                  <button
                    onClick={() => { setConvLoadError(false); setLoadingConvs(true); void loadConversations(true); }}
                    className="mt-1 px-4 py-1.5 rounded-full text-xs font-medium transition-opacity hover:opacity-80"
                    style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                    Try again
                  </button>
                </div>
              ) : folder !== 'requests' && conversations.length === 0 ? (
                /* Desktop empty inbox — celestial treatment */
                <div className="flex flex-col items-center justify-center gap-4 px-5 py-10 text-center">
                  <div className="relative w-20 h-20 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full opacity-15"
                      style={{ background: 'radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)' }} />
                    <svg viewBox="0 0 80 80" className="w-16 h-16" aria-hidden="true">
                      <circle cx="40" cy="40" r="16" fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" opacity="0.5" />
                      <circle cx="40" cy="40" r="8" fill="hsl(var(--primary))" opacity="0.25" />
                      <circle cx="40" cy="40" r="4" fill="hsl(var(--primary))" opacity="0.6" />
                      {[0,60,120,180,240,300].map((deg, i) => {
                        const rad = (deg * Math.PI) / 180;
                        const x = 40 + 26 * Math.cos(rad);
                        const y = 40 + 26 * Math.sin(rad);
                        return <circle key={i} cx={x} cy={y} r="1.5" fill="hsl(var(--accent))" opacity="0.7" />;
                      })}
                      <path d="M40 12 L41.5 18 L40 16.5 L38.5 18 Z" fill="hsl(var(--primary))" opacity="0.5" />
                    </svg>
                  </div>
                  <div className="space-y-1">
                    <p className="font-serif text-base" style={{ color: 'hsl(var(--foreground))' }}>
                      Every connection begins with a little magic.
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: 'hsl(var(--muted-foreground))' }}>
                      Messages are private and encrypted.
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5 w-full">
                    <button
                      onClick={() => { setShowCompose(v => !v); setComposeQuery(''); setComposeResults([]); }}
                      className="w-full py-2 rounded-full text-xs font-medium transition-opacity hover:opacity-80"
                      style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                      Start a Conversation
                    </button>
                    <button
                      onClick={() => navigate('/community/discover')}
                      className="w-full py-2 rounded-full text-xs font-medium transition-opacity hover:opacity-80"
                      style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))' }}>
                      Discover Members
                    </button>
                    <div className="flex items-center gap-3 mt-0.5">
                      <button
                        onClick={() => setShowPrivacySettings(true)}
                        className="text-xs transition-opacity hover:opacity-70"
                        style={{ color: 'hsl(var(--muted-foreground))' }}>
                        Privacy settings
                      </button>
                      <span style={{ color: 'hsl(var(--border))' }}>·</span>
                      <button
                        onClick={() => setShowBlockedMembers(true)}
                        className="text-xs transition-opacity hover:opacity-70"
                        style={{ color: 'hsl(var(--muted-foreground))' }}>
                        Blocked members
                      </button>
                    </div>
                  </div>
                </div>
              ) : folder !== 'requests' && filteredConversations.length === 0 ? (
                /* Desktop empty filter */
                <div className="flex flex-col items-center justify-center gap-2 px-5 py-10 text-center">
                  {inboxSearch ? (
                    <>
                      <svg viewBox="0 0 24 24" className="w-8 h-8 opacity-25" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"
                        style={{ color: 'hsl(var(--muted-foreground))' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0015.803 15.803z" />
                      </svg>
                      <p className="text-sm font-medium" style={{ color: 'hsl(var(--foreground))' }}>No results</p>
                      <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Try a different name or username</p>
                      <button onClick={() => setInboxSearch('')} className="text-xs underline mt-1" style={{ color: 'hsl(var(--primary))' }}>Clear search</button>
                    </>
                  ) : inboxFilter === 'unread' ? (
                    <>
                      <svg viewBox="0 0 24 24" className="w-8 h-8 opacity-25" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"
                        style={{ color: 'hsl(var(--primary))' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm font-medium" style={{ color: 'hsl(var(--foreground))' }}>All caught up ✨</p>
                      <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>No unread messages</p>
                      <button onClick={() => setInboxFilter('all')} className="text-xs underline mt-1" style={{ color: 'hsl(var(--primary))' }}>View all</button>
                    </>
                  ) : inboxFilter === 'archived' ? (
                    <>
                      <svg viewBox="0 0 24 24" className="w-8 h-8 opacity-25" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"
                        style={{ color: 'hsl(var(--muted-foreground))' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                      </svg>
                      <p className="text-sm font-medium" style={{ color: 'hsl(var(--foreground))' }}>No archived chats</p>
                      <button onClick={() => setInboxFilter('all')} className="text-xs underline mt-1" style={{ color: 'hsl(var(--primary))' }}>Back to inbox</button>
                    </>
                  ) : (
                    <>
                      <MessageCircle className="w-8 h-8 opacity-25" style={{ color: 'hsl(var(--muted-foreground))' }} />
                      <p className="text-sm font-medium" style={{ color: 'hsl(var(--foreground))' }}>No conversations here</p>
                      <button onClick={() => setInboxFilter('all')} className="text-xs underline mt-1" style={{ color: 'hsl(var(--primary))' }}>Back to inbox</button>
                    </>
                  )}
                </div>
              ) : folder === 'requests' ? null : (
                filteredConversations.map(conv => (
                  <button key={conv.id}
                    onClick={() => conv.otherUser && void openConversation(conv.id, conv.otherUser)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:opacity-90"
                    style={{
                      background: activeConvId === conv.id ? 'hsl(var(--muted))' : 'transparent',
                      borderBottom: '1px solid hsl(var(--border))',
                    }}>
                    <a
                      href={conv.otherUser?.username ? `/u/${conv.otherUser.username}` : undefined}
                      onClick={e => e.stopPropagation()}
                      className="relative flex-shrink-0"
                      aria-label={conv.otherUser?.username ? `View ${conv.otherUser.name ?? conv.otherUser.username}'s profile` : undefined}>
                      <Avatar user={conv.otherUser} size={40} />
                      {conv.otherUser && (
                        <div className="absolute -bottom-0.5 -right-0.5">
                          <OnlineDot userId={conv.otherUser.id} size={10} presenceData={batchPresence[conv.otherUser.id] ?? null} />
                        </div>
                      )}
                    </a>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-sm truncate ${conv.unreadCount > 0 ? 'font-semibold' : ''}`}
                          style={{ color: 'hsl(var(--foreground))' }}>
                          {conv.otherUser?.name ?? conv.otherUser?.username ?? 'Unknown'}
                          {conv.isCoven && <span className="ml-1 text-xs" title="Coven friend">🔮</span>}
                        </span>
                        {conv.lastMessage && (
                          <span className="text-xs flex-shrink-0 ml-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
                            {formatTime(conv.lastMessage.createdAt)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-xs truncate" style={{ color: 'hsl(var(--muted-foreground))' }}>
                          {conv.lastMessage ? (conv.lastMessage.systemMessage ? richCardPreview(conv.lastMessage.systemMessage) : '🔒 Encrypted message') : 'No messages yet'}
                        </span>
                        {conv.unreadCount > 0 && (
                          <span className="ml-1 flex-shrink-0 text-xs w-5 h-5 rounded-full flex items-center justify-center"
                            style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                            {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Desktop footer bar — Drafts only; New Message is the icon in the sidebar header */}
            <div className="flex gap-2 p-3" style={{ borderTop: '1px solid hsl(var(--border))' }}>
              <button
                onClick={() => { if (activeConvId) void switchFolder('drafts'); }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-medium transition-opacity hover:opacity-80"
                style={{ background: 'hsl(var(--muted))', color: activeConvId ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))', border: '1px solid hsl(var(--border))', opacity: activeConvId ? 1 : 0.5 }}>
                <FileText className="w-3.5 h-3.5" />
                Drafts
              </button>
            </div>
          </div>

          {/* Desktop thread panel */}
          <div className="flex-1 flex flex-col">
            {activeGroupId ? (
              <GroupThreadView
                group={groups.find(g => g.id === activeGroupId) ?? null}
                messages={groupMessages}
                members={groupMembers}
                loading={loadingGroupMsgs}
                myId={myId}
                draft={groupDraft}
                setDraft={setGroupDraft}
                sending={sendingGroup}
                sendError={groupSendError}
                onSend={() => void sendGroupMessage()}
                onLeave={() => void leaveGroup(activeGroupId)}
                onClose={() => { setActiveGroupId(null); setGroupMessages([]); setGroupMembers([]); }}
              />
            ) : !activeConvId ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: 'hsl(var(--muted))' }}>
                  <Lock className="w-7 h-7" style={{ color: 'hsl(var(--muted-foreground))' }} />
                </div>
                <p className="font-serif text-lg" style={{ color: 'hsl(var(--foreground))' }}>{pageContent.emptyThread}</p>
                <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>{pageContent.emptyThreadHint}</p>
              </div>
            ) : (
              <DesktopThread
                refreshOtherUserKey={refreshOtherUserKey}
                deleteConversation={deleteConversation}
                activeOtherUser={activeOtherUser}
                messages={messages}
                loadingMsgs={loadingMsgs}
                folder={folder}
                switchFolder={switchFolder}
                myId={myId}
                draft={draft}
                setDraft={setDraft}
                sending={sending}
                handleSend={handleSend}
                otherUserPublicKey={otherUserPublicKey}
                openMenuId={openMenuId}
                setOpenMenuId={setOpenMenuId}
                updateMessageStatus={updateMessageStatus}
                bottomRef={bottomRef}
                inputRef={inputRef}
                otherIsTyping={otherIsTyping}
                lastReadMsgId={lastReadMsgId}
                replyTo={replyTo}
                setReplyTo={setReplyTo}
                editingMsg={editingMsg}
                setEditingMsg={setEditingMsg}
                reactionPickerMsgId={reactionPickerMsgId}
                setReactionPickerMsgId={setReactionPickerMsgId}
                toggleReaction={toggleReaction}
                softDeleteMessage={softDeleteMessage}
                wallpaper={wallpaper}
                isCoven={isCoven}
                covenStatus={covenStatus}
                covenConnectionId={covenConnectionId}
                onCovenAction={handleCovenAction}
                onOpenWallpaperPicker={() => { /* inline only */ }}
                onSaveWallpaper={(prefs) => { setWallpaper(prefs); void fetch(`/api/conversations/${activeConvId}/wallpaper`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(prefs) }); }}
                activeConvId={activeConvId}
                showSearch={showSearch}
                onToggleSearch={() => setShowSearch(v => !v)}
                onSearchJump={scrollToMessage}
                sendError={sendError}
                hasMoreMessages={hasMoreMessages}
                loadingOlder={loadingOlder}
                onLoadOlder={() => void loadOlderMessages()}
                deleteForSelf={deleteForSelf}
                showSharedMedia={showSharedMedia}
                onToggleSharedMedia={() => setShowSharedMedia(v => !v)}
                onReportMessage={(msgId) => { setReportingMsgId(msgId); setReportReason(''); setReportDetails(''); setReportDone(false); }}
                onBlockUser={blockUserFromConversation}
              />
            )}
          </div>
        </div>
      </div>

      {/* Compose modal removed — inline compose is now in the sidebar */}

      {/* Visit Site button removed per UX brief — was obstructing composer */}

      {/* Wallpaper picker modal removed — now inline in thread header */}

      {/* ── Blocked Members modal ── */}
      <BlockedMembersModal open={showBlockedMembers} onClose={() => setShowBlockedMembers(false)} />

      {/* ── Report Message modal ── */}
      <AnimatePresence>
        {reportingMsgId !== null && (
          <>
            <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setReportingMsgId(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 rounded-3xl shadow-2xl max-w-md mx-auto"
              style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
              <div className="flex items-center justify-between px-5 pt-5 pb-3" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                <p className="font-serif text-lg" style={{ color: 'hsl(var(--foreground))' }}>Report Message</p>
                <button onClick={() => setReportingMsgId(null)} style={{ color: 'hsl(var(--muted-foreground))' }}>
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 flex flex-col gap-3">
                {reportDone ? (
                  <div className="flex flex-col items-center gap-2 py-6 text-center">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'hsl(var(--success) / 0.15)' }}>
                      <span className="text-2xl">✓</span>
                    </div>
                    <p className="font-medium" style={{ color: 'hsl(var(--foreground))' }}>Report submitted</p>
                    <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Thank you. Our team will review this message.</p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Why are you reporting this message?</p>
                    <div className="flex flex-col gap-1.5">
                      {[
                        { value: 'harassment', label: 'Harassment or bullying' },
                        { value: 'hate_speech', label: 'Hate speech' },
                        { value: 'spam', label: 'Spam' },
                        { value: 'threats', label: 'Threats or violence' },
                        { value: 'sexual_content', label: 'Unwanted sexual content' },
                        { value: 'misinformation', label: 'Misinformation' },
                        { value: 'other', label: 'Other' },
                      ].map(opt => (
                        <button key={opt.value}
                          onClick={() => setReportReason(opt.value)}
                          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-left transition-opacity active:opacity-70"
                          style={{
                            background: reportReason === opt.value ? 'hsl(var(--primary) / 0.15)' : 'hsl(var(--muted))',
                            border: reportReason === opt.value ? '1px solid hsl(var(--primary) / 0.4)' : '1px solid transparent',
                            color: 'hsl(var(--foreground))',
                          }}>
                          <span className="w-4 h-4 rounded-full flex-shrink-0 border-2 flex items-center justify-center"
                            style={{ borderColor: reportReason === opt.value ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }}>
                            {reportReason === opt.value && <span className="w-2 h-2 rounded-full" style={{ background: 'hsl(var(--primary))' }} />}
                          </span>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {reportReason && (
                      <textarea
                        value={reportDetails}
                        onChange={e => setReportDetails(e.target.value)}
                        placeholder="Additional details (optional)"
                        maxLength={500}
                        rows={3}
                        className="w-full rounded-xl px-3 py-2 text-sm resize-none"
                        style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                      />
                    )}
                    <button
                      onClick={() => void submitMessageReport()}
                      disabled={!reportReason || reportSubmitting}
                      className="w-full py-3 rounded-2xl text-sm font-semibold transition-opacity disabled:opacity-50"
                      style={{ background: 'hsl(var(--destructive))', color: 'hsl(var(--destructive-foreground))' }}>
                      {reportSubmitting ? 'Submitting…' : 'Submit Report'}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Create Group modal ── */}
      <AnimatePresence>
        {showCreateGroup && (
          <>
            <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setShowCreateGroup(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 rounded-3xl shadow-2xl max-w-md mx-auto"
              style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
              <div className="flex items-center justify-between px-5 pt-5 pb-3" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                <p className="font-serif text-lg" style={{ color: 'hsl(var(--foreground))' }}>New Group</p>
                <button onClick={() => setShowCreateGroup(false)} style={{ color: 'hsl(var(--muted-foreground))' }}>
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="p-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: 'hsl(var(--muted-foreground))' }}>Group name *</label>
                  <Input
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                    placeholder="e.g. Moon Circle"
                    maxLength={60}
                    style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))' }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: 'hsl(var(--muted-foreground))' }}>Description (optional)</label>
                  <Input
                    value={newGroupDescription}
                    onChange={e => setNewGroupDescription(e.target.value)}
                    placeholder="What's this group about?"
                    maxLength={200}
                    style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))' }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: 'hsl(var(--muted-foreground))' }}>Add members *</label>
                  <Input
                    value={newGroupMemberSearch}
                    onChange={e => setNewGroupMemberSearch(e.target.value)}
                    placeholder="Search by name or username…"
                    style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))' }}
                  />
                  {newGroupMemberResults.length > 0 && (
                    <div className="mt-1 rounded-xl overflow-hidden" style={{ border: '1px solid hsl(var(--border))' }}>
                      {newGroupMemberResults.slice(0, 6).map(u => (
                        <button key={u.id}
                          onClick={() => { setNewGroupMemberIds(prev => [...prev, u.id]); setNewGroupMemberSearch(''); setNewGroupMemberResults([]); }}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:opacity-80 transition-opacity"
                          style={{ background: 'hsl(var(--muted))', borderBottom: '1px solid hsl(var(--border) / 0.5)' }}>
                          <Avatar user={u} size={28} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: 'hsl(var(--foreground))' }}>{u.name ?? u.username}</p>
                            {u.username && <p className="text-xs truncate" style={{ color: 'hsl(var(--muted-foreground))' }}>@{u.username}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {newGroupMemberIds.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {newGroupMemberIds.map(id => {
                        const found = composeResults.find(u => u.id === id) ?? newGroupMemberResults.find(u => u.id === id);
                        return (
                          <span key={id} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                            style={{ background: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))', border: '1px solid hsl(var(--primary) / 0.3)' }}>
                            {found?.name ?? found?.username ?? id}
                            <button onClick={() => setNewGroupMemberIds(prev => prev.filter(i => i !== id))} aria-label="Remove">
                              <XIcon className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => void createGroup()}
                  disabled={!newGroupName.trim() || newGroupMemberIds.length === 0 || creatingGroup}
                  className="w-full py-3 rounded-2xl text-sm font-semibold transition-opacity disabled:opacity-50"
                  style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                  {creatingGroup ? 'Creating…' : 'Create Group'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Group Invitations modal ── */}
      <AnimatePresence>
        {showGroupInvitations && (
          <>
            <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setShowGroupInvitations(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 rounded-3xl shadow-2xl max-w-md mx-auto"
              style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
              <div className="flex items-center justify-between px-5 pt-5 pb-3" style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                <p className="font-serif text-lg" style={{ color: 'hsl(var(--foreground))' }}>Group Invitations</p>
                <button onClick={() => setShowGroupInvitations(false)} style={{ color: 'hsl(var(--muted-foreground))' }}>
                  <XIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
                {loadingGroupInvitations ? (
                  <div className="flex justify-center py-8">
                    <span className="w-6 h-6 rounded-full border-2 border-current border-t-transparent animate-spin" style={{ color: 'hsl(var(--primary))' }} />
                  </div>
                ) : groupInvitations.length === 0 ? (
                  <p className="text-sm text-center py-8" style={{ color: 'hsl(var(--muted-foreground))' }}>No pending invitations</p>
                ) : groupInvitations.map(inv => (
                  <div key={inv.id} className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: 'hsl(var(--muted))' }}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, hsl(var(--accent)) 0%, hsl(var(--primary)) 100%)' }}>
                      <Users className="w-4 h-4" style={{ color: 'hsl(var(--primary-foreground))' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'hsl(var(--foreground))' }}>{inv.groupName}</p>
                      <p className="text-xs truncate" style={{ color: 'hsl(var(--muted-foreground))' }}>
                        Invited by {inv.inviterName ?? inv.inviterUsername ?? 'a member'}
                      </p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => void respondToGroupInvitation(inv.id, true)}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold transition-opacity active:opacity-70"
                        style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                        Join
                      </button>
                      <button
                        onClick={() => void respondToGroupInvitation(inv.id, false)}
                        className="px-3 py-1.5 rounded-full text-xs font-medium transition-opacity active:opacity-70"
                        style={{ background: 'hsl(var(--muted-foreground) / 0.15)', color: 'hsl(var(--muted-foreground))' }}>
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ── GroupThreadView ───────────────────────────────────────────────────────────

interface GroupThreadViewProps {
  group: GroupSummary | null;
  messages: GroupMessage[];
  members: GroupMember[];
  loading: boolean;
  myId: string;
  draft: string;
  setDraft: (v: string) => void;
  sending: boolean;
  sendError: string | null;
  onSend: () => void;
  onLeave: () => void;
  onClose: () => void;
  mobile?: boolean;
}

function GroupThreadView({ group, messages, members, loading, myId, draft, setDraft, sending, sendError, onSend, onLeave, onClose, mobile }: GroupThreadViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showMembers, setShowMembers] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); }
  }

  const activeGroup = group;

  return (
    <div className={mobile ? 'flex flex-col h-full' : 'flex flex-col h-full'}>
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3"
        style={{
          paddingTop: mobile ? 'max(12px, env(safe-area-inset-top, 0px))' : undefined,
          borderBottom: '1px solid hsl(var(--border))',
          background: 'hsl(var(--card))',
        }}>
        <button onClick={onClose} className="flex items-center gap-0.5 -ml-1 py-1 pr-2 rounded-lg active:opacity-60 transition-opacity" aria-label="Back">
          <ArrowLeft className="w-5 h-5" style={{ color: 'hsl(var(--primary))' }} />
          {mobile && <span className="text-sm font-medium" style={{ color: 'hsl(var(--primary))' }}>Back</span>}
        </button>
        <button
          onClick={() => setShowMembers(v => !v)}
          className="flex-1 flex items-center gap-2.5 min-w-0 text-left"
          aria-label="View members">
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, hsl(var(--accent)) 0%, hsl(var(--primary)) 100%)' }}>
            {activeGroup?.avatarUrl ? (
              <img src={activeGroup.avatarUrl} alt={activeGroup.name} className="w-full h-full rounded-full object-cover" />
            ) : (
              <Users className="w-4 h-4" style={{ color: 'hsl(var(--primary-foreground))' }} />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'hsl(var(--foreground))' }}>{activeGroup?.name ?? 'Group'}</p>
            <p className="text-xs truncate" style={{ color: 'hsl(var(--muted-foreground))' }}>{activeGroup?.memberCount ?? members.length} members</p>
          </div>
        </button>
        <button
          onClick={onLeave}
          className="flex-shrink-0 text-xs px-2.5 py-1 rounded-full transition-opacity active:opacity-70"
          style={{ color: 'hsl(var(--destructive))', border: '1px solid hsl(var(--destructive) / 0.3)' }}>
          Leave
        </button>
      </div>

      {/* Members panel */}
      <AnimatePresence>
        {showMembers && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden flex-shrink-0"
            style={{ borderBottom: '1px solid hsl(var(--border))', background: 'hsl(var(--muted))' }}>
            <div className="px-4 py-3">
              <p className="text-xs font-semibold mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>Members ({members.length})</p>
              <div className="flex flex-wrap gap-2">
                {members.map(m => (
                  <div key={m.userId} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
                    style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
                    <div className="w-4 h-4 rounded-full overflow-hidden flex-shrink-0"
                      style={{ background: 'hsl(var(--muted-foreground) / 0.3)' }}>
                      {m.image && <img src={m.image} alt={m.name ?? ''} className="w-full h-full object-cover" />}
                    </div>
                    <span style={{ color: 'hsl(var(--foreground))' }}>{m.name ?? m.username ?? 'Member'}</span>
                    {m.role === 'admin' && <span style={{ color: 'hsl(var(--primary))' }}>★</span>}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
        {loading ? (
          <div className="flex flex-col gap-3 pt-4">
            {[1, 2, 3].map(i => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'} animate-pulse`}>
                <div className="h-10 rounded-3xl" style={{ width: `${35 + i * 12}%`, background: 'hsl(var(--muted))' }} />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <Users className="w-10 h-10 opacity-20" style={{ color: 'hsl(var(--muted-foreground))' }} />
            <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>No messages yet. Say hello! ✨</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMine = msg.senderId === myId;
            const isSystem = !!msg.systemMessage;
            const isRich = isRichCard(msg.systemMessage);
            const prevMsg = idx > 0 ? messages[idx - 1] : undefined;
            const showDateSep = !prevMsg || new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();
            const showSender = !isMine && !isSystem && (!prevMsg || prevMsg.senderId !== msg.senderId);
            return (
              <React.Fragment key={msg.id}>
                {showDateSep && (
                  <div className="flex items-center gap-3 py-1">
                    <div className="flex-1 h-px" style={{ background: 'hsl(var(--border))' }} />
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: 'hsl(var(--muted-foreground))', background: 'hsl(var(--muted))' }}>
                      {new Date(msg.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                    <div className="flex-1 h-px" style={{ background: 'hsl(var(--border))' }} />
                  </div>
                )}
                {isRich && msg.systemMessage ? (
                  <div className={isMine ? 'self-end' : 'self-start'} style={{ maxWidth: '78%' }}>
                    <RichMessageCard systemMessage={msg.systemMessage} isMine={isMine} />
                  </div>
                ) : isSystem ? (
                  <div className="text-center text-xs py-1" style={{ color: 'hsl(var(--muted-foreground))' }}>✨ {msg.systemMessage}</div>
                ) : (
                  <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                    {showSender && (
                      <p className="text-xs mb-0.5 px-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
                        {msg.senderName ?? msg.senderUsername ?? 'Member'}
                      </p>
                    )}
                    <div className={`max-w-[75%] px-3.5 py-2 rounded-3xl text-sm leading-relaxed ${isMine ? 'rounded-br-md' : 'rounded-bl-md'}`}
                      style={{
                        background: isMine ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                        color: isMine ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
                      }}>
                      {msg.deletedAt ? <em style={{ opacity: 0.6 }}>Message deleted</em> : msg.content}
                    </div>
                    <span className="text-xs mt-0.5 px-1" style={{ color: 'hsl(var(--muted-foreground))' }}>
                      {new Date(msg.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                )}
              </React.Fragment>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="flex-shrink-0 px-4 py-3 flex items-center gap-2"
        style={{
          paddingBottom: mobile ? 'max(12px, env(safe-area-inset-bottom, 0px))' : undefined,
          borderTop: '1px solid hsl(var(--border))',
          background: 'hsl(var(--card))',
        }}>
        {sendError && (
          <p className="text-xs mb-1 w-full text-center" style={{ color: 'hsl(var(--destructive))' }}>{sendError}</p>
        )}

        <Input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message the group…"
          disabled={sending}
          className="flex-1 rounded-full text-sm"
          style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))' }}
        />
        <button
          onClick={onSend}
          disabled={!draft.trim() || sending}
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-opacity disabled:opacity-40"
          style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
          aria-label="Send">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
