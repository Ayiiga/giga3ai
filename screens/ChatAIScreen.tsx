import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../lib/theme';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { Authenticated, Unauthenticated } from 'convex/react';
import { useRoute, useNavigation as useNav } from '@react-navigation/native';
import { saveResult } from '../lib/savedStorage';
import { FREE_DAILY_LIMIT } from '../lib/usageTracker';
import { useA0Purchases } from 'a0-purchases';
import PaywallScreen from './PaywallScreen';
import { useCategory } from '../lib/categoryContext';
import { getCurrentUserId, signInWithGoogle } from '../lib/platformAuth';

type Message = {
  _id: Id<'messages'>;
  _creationTime: number;
  role: 'user' | 'assistant';
  content: string;
};

type Conversation = {
  _id: Id<'conversations'>;
  _creationTime: number;
  title: string;
  lastMessageAt: number;
};

const CHAT_SUGGESTIONS: Record<string, { label: string; icon: string; prompt: string }[]> = {
  student: [
    { label: 'Write thesis introduction', icon: 'school', prompt: 'Help me write a thesis introduction for my research on ' },
    { label: 'Research proposal help', icon: 'flask', prompt: 'Help me write a research proposal about ' },
    { label: 'Essay structure', icon: 'pencil', prompt: 'Help me structure an essay about ' },
    { label: 'Literature review', icon: 'library', prompt: 'Help me write a literature review on ' },
    { label: 'Study notes', icon: 'reader', prompt: 'Create study notes for ' },
    { label: 'Problem statement', icon: 'alert-circle', prompt: 'Help me write a problem statement for my research on ' },
  ],
  tutor: [
    { label: 'Create lesson plan', icon: 'school', prompt: 'Create a detailed lesson plan for teaching ' },
    { label: 'Academic template', icon: 'create', prompt: 'Generate an academic template for ' },
    { label: 'Quiz questions', icon: 'help-circle', prompt: 'Generate quiz questions about ' },
    { label: 'Educational content', icon: 'book', prompt: 'Write educational content about ' },
    { label: 'Assignment prompt', icon: 'document-text', prompt: 'Create an assignment prompt for students on ' },
    { label: 'Grading rubric', icon: 'checkmark-done', prompt: 'Create a grading rubric for ' },
  ],
  creator: [
    { label: 'Book outline', icon: 'book', prompt: 'Create a book outline for ' },
    { label: 'Chapter draft', icon: 'layers', prompt: 'Write a chapter draft about ' },
    { label: 'Marketing copy', icon: 'megaphone', prompt: 'Write marketing copy for ' },
    { label: 'Social captions', icon: 'chatbox-ellipses', prompt: 'Write social media captions for ' },
    { label: 'Story ideas', icon: 'planet', prompt: 'Generate story ideas about ' },
    { label: 'Content strategy', icon: 'trending-up', prompt: 'Create a content strategy for ' },
  ],
  entrepreneur: [
    { label: 'Business proposal', icon: 'briefcase', prompt: 'Write a business proposal for ' },
    { label: 'Marketing text', icon: 'megaphone', prompt: 'Write marketing text for ' },
    { label: 'Email campaign', icon: 'mail', prompt: 'Write an email campaign for ' },
    { label: 'Ad copy', icon: 'pricetag', prompt: 'Write ad copy for ' },
    { label: 'Book outline', icon: 'book', prompt: 'Create a book outline for ' },
    { label: 'Sales page copy', icon: 'trending-up', prompt: 'Write sales page copy for ' },
  ],
};

function ConversationList({
  userId,
  onSelect,
  onNew,
  onBack,
}: {
  userId: string;
  onSelect: (id: Id<'conversations'>, title: string) => void;
  onNew: () => void;
  onBack: () => void;
}) {
  const conversations = useQuery(api.chat.listConversations, { userId }) ?? [];
  const deleteConversation = useMutation(api.chat.deleteConversation);

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { flex: 1 }]}>Conversations</Text>
          <TouchableOpacity style={styles.newChatButton} onPress={onNew} activeOpacity={0.7}>
            <Ionicons name="add" size={20} color={colors.textInverse} />
            <Text style={styles.newChatText}>New</Text>
          </TouchableOpacity>
        </View>

        {conversations.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="chatbubbles-outline" size={48} color={colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptySubtitle}>Tap "New" to start chatting with Giga3 AI</Text>
          </View>
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={(item: Conversation) => item._id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }: { item: Conversation }) => (
              <TouchableOpacity
                style={styles.conversationItem}
                onPress={() => onSelect(item._id, item.title)}
                activeOpacity={0.7}
              >
                <View style={styles.conversationIcon}>
                  <Ionicons name="chatbubble" size={18} color={colors.gold} />
                </View>
                <View style={styles.conversationContent}>
                  <Text style={styles.conversationTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.conversationTime}>
                    {new Date(item.lastMessageAt).toLocaleDateString()}
                  </Text>
                </View>
                <TouchableOpacity
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={() => deleteConversation({ conversationId: item._id })}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.textTertiary} />
                </TouchableOpacity>
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

function ChatView({
  conversationId,
  conversationTitle,
  userId,
  onBack,
  onSaveMessage,
  initialPrompt,
  onPromptConsumed,
  savedMessageIds,
  isPremium,
  onLimitReached,
  category,
}: {
  conversationId: Id<'conversations'>;
  conversationTitle: string;
  userId: string;
  onBack: () => void;
  onSaveMessage: (messageId: string, content: string) => void;
  initialPrompt?: string;
  onPromptConsumed?: () => void;
  savedMessageIds: Set<string>;
  isPremium: boolean;
  onLimitReached: (mode?: 'subscription' | 'credits') => void;
  category: string;
}) {
  const [input, setInput] = useState('');
  const [provider, setProvider] = useState<'auto' | 'a0' | 'openai' | 'anthropic' | 'gemini'>('auto');
  const [mode, setMode] = useState<'standard' | 'fast' | 'educational'>('standard');
  const messages = useQuery(api.chat.listMessages, { conversationId }) ?? [];
  const sendMessage = useMutation(api.chat.sendMessage);
  const flatListRef = useRef<any>(null);
  const [sending, setSending] = useState(false);
  const accessStatus = useQuery(api.credits.getAccessStatus, userId ? { userId } : 'skip');

  const isWaitingForAI =
    messages.length > 0 && messages[messages.length - 1].role === 'user';

  // Pre-fill input when navigating from a Home tool card
  useEffect(() => {
    if (initialPrompt) {
      setInput(initialPrompt);
      onPromptConsumed?.();
    }
  }, [initialPrompt, onPromptConsumed]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const suggestions = CHAT_SUGGESTIONS[category] || CHAT_SUGGESTIONS.student;

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    if (!isPremium && accessStatus && !accessStatus.canUseFreeEducational) {
      Alert.alert(
        'Daily Limit Reached',
        `You've used all ${FREE_DAILY_LIMIT} free chats for today. Choose a subscription or buy credits to keep going.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Buy Credits', onPress: () => onLimitReached('credits') },
          { text: 'Subscribe', onPress: () => onLimitReached('subscription') },
        ]
      );
      return;
    }

    setInput('');
    setSending(true);
    try {
      await sendMessage({ conversationId, content: trimmed, provider, mode, userId });
    } catch (e: any) {
      Alert.alert('Chat unavailable', e?.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  }, [input, sending, conversationId, sendMessage, isPremium, onLimitReached, provider, mode, accessStatus, userId]);

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    const isSaved = savedMessageIds.has(item._id);
    return (
      <View style={[styles.messageBubbleRow, isUser && styles.messageBubbleRowUser]}>
        {!isUser && (
          <View style={styles.aiAvatar}>
            <Ionicons name="sparkles" size={14} color={colors.gold} />
          </View>
        )}
        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.aiBubble]}>
          <Text style={[styles.messageText, isUser && styles.userMessageText]}>
            {item.content}
          </Text>
        </View>
        {!isUser && (
          <TouchableOpacity
            style={styles.saveButton}
            onPress={() => onSaveMessage(item._id, item.content)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            disabled={isSaved}
          >
            <Ionicons
              name={isSaved ? 'bookmark' : 'bookmark-outline'}
              size={16}
              color={isSaved ? colors.gold : colors.textTertiary}
            />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.chatHeaderContent}>
            <Text style={styles.chatHeaderTitle} numberOfLines={1}>
              {conversationTitle}
            </Text>
            <Text style={styles.chatHeaderSubtitle}>
              {isPremium ? 'Premium active' : `${accessStatus?.educationalRemaining ?? FREE_DAILY_LIMIT} free chats left`}
            </Text>
          </View>
          <View style={styles.modePills}>
            {(['auto', 'openai', 'anthropic', 'gemini'] as const).map((item) => (
              <TouchableOpacity
                key={item}
                onPress={() => setProvider(item)}
                style={[styles.modeChip, provider === item && styles.modeChipActive]}
              >
                <Text style={[styles.modeChipText, provider === item && styles.modeChipTextActive]}>
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.modePills}>
            {(['standard', 'fast', 'educational'] as const).map((item) => (
              <TouchableOpacity
                key={item}
                onPress={() => setMode(item)}
                style={[styles.modeChip, mode === item && styles.modeChipActive]}
              >
                <Text style={[styles.modeChipText, mode === item && styles.modeChipTextActive]}>
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {!isPremium && (
            <View style={styles.usagePill}>
              <Ionicons name="flash" size={12} color={(accessStatus?.educationalRemaining ?? FREE_DAILY_LIMIT) <= 1 ? colors.warning : colors.gold} />
              <Text style={[styles.usagePillText, (accessStatus?.educationalRemaining ?? FREE_DAILY_LIMIT) <= 1 && { color: colors.warning }]}>
                {accessStatus?.educationalRemaining ?? FREE_DAILY_LIMIT}/{FREE_DAILY_LIMIT}
              </Text>
            </View>
          )}
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item: Message) => item._id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          ListEmptyComponent={
            <View style={styles.chatEmpty}>
              <Ionicons name="sparkles" size={32} color={colors.gold} />
              <Text style={styles.chatEmptyText}>Send a message to get started</Text>
              <Text style={styles.chatEmptyHint}>or try a suggestion below</Text>
              <Text style={styles.chatEmptyHint}>AI responses may contain errors — always verify important information</Text>
              <View style={styles.suggestionsWrap}>
                {suggestions.map((s: { label: string; icon: string; prompt: string }, i: number) => (
                  <TouchableOpacity key={i} style={styles.suggestionChip} onPress={() => setInput(s.prompt)} activeOpacity={0.7}>
                    <Ionicons name={s.icon as any} size={14} color={colors.gold} />
                    <Text style={styles.suggestionChipText}>{s.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          }
          ListHeaderComponent={messages.length <= 1 ? (
            <View style={styles.suggestionsWrap}>
              <Text style={styles.suggestionsTitle}>Try asking:</Text>
              {suggestions.map((s: { label: string; icon: string; prompt: string }, i: number) => (
                <TouchableOpacity key={i} style={styles.suggestionChip} onPress={() => setInput(s.prompt)} activeOpacity={0.7}>
                  <Ionicons name="flash" size={14} color={colors.gold} />
                  <Text style={styles.suggestionText}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
          ListFooterComponent={
            isWaitingForAI ? (
              <View style={styles.typingIndicator}>
                <View style={styles.aiAvatar}>
                  <Ionicons name="sparkles" size={14} color={colors.gold} />
                </View>
                <View style={styles.typingDots}>
                  <ActivityIndicator size="small" color={colors.gold} />
                  <Text style={styles.typingText}>Thinking...</Text>
                </View>
              </View>
            ) : null
          }
        />

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        >
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Type a message..."
              placeholderTextColor={colors.textTertiary}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={2000}
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
            <TouchableOpacity
              style={[styles.sendButton, !input.trim() && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!input.trim() || sending}
              activeOpacity={0.7}
            >
              <Ionicons
                name="send"
                size={18}
                color={input.trim() ? colors.textInverse : colors.textTertiary}
              />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function AuthPrompt() {
  const navigation = useNav<any>();
  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { flex: 1 }]}>Chat AI</Text>
        </View>
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="lock-closed-outline" size={48} color={colors.textTertiary} />
          </View>
          <Text style={styles.emptyTitle}>Sign in to Chat</Text>
          <Text style={styles.emptySubtitle}>
            Create an account to start chatting with Giga3 AI
          </Text>
          <TouchableOpacity
            style={styles.signInButton}
            onPress={() => signInWithGoogle()}
            activeOpacity={0.7}
          >
            <Ionicons name="logo-google" size={18} color={colors.textInverse} />
            <Text style={styles.signInButtonText}>Sign in with Google</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

function ChatContent() {
  const userId = getCurrentUserId();
  const route = useRoute<any>();
  const navigation = useNav<any>();
  const { isPremium } = useA0Purchases();
  const { category } = useCategory();
  const [activeConversation, setActiveConversation] = useState<{
    id: Id<'conversations'>;
    title: string;
  } | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [savedMessageIds, setSavedMessageIds] = useState<Set<string>>(new Set());
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallType, setPaywallType] = useState<'subscription' | 'credits'>('subscription');
  const promptConsumedRef = React.useRef(false);

  const createConversation = useMutation(api.chat.createConversation);

  // Handle initialPrompt from navigation params (e.g., from Home tool cards)
  useEffect(() => {
    const initialPrompt = route.params?.initialPrompt;
    if (initialPrompt && !activeConversation && !promptConsumedRef.current) {
      promptConsumedRef.current = true;
      setPendingPrompt(initialPrompt);
      (async () => {
        const id = await createConversation({
          userId,
          title: 'New Conversation',
        });
        setActiveConversation({ id, title: 'New Conversation' });
      })();
    }
  }, [route.params?.initialPrompt, activeConversation, createConversation, userId]);

  const handleNew = useCallback(async () => {
    const id = await createConversation({
      userId,
      title: 'New Conversation',
    });
    setActiveConversation({ id, title: 'New Conversation' });
  }, [userId, createConversation]);

  const handleSaveMessage = useCallback(
    async (messageId: string, content: string) => {
      if (savedMessageIds.has(messageId)) return;
      try {
        await saveResult({
          toolId: 'chat-ai',
          toolName: 'Chat AI',
          toolIcon: 'chatbubble-ellipses',
          toolColor: colors.gold,
          prompt: activeConversation?.title ?? 'Chat Conversation',
          result: content,
          resultType: 'text',
        });
        setSavedMessageIds((prev: Set<string>) => new Set(prev).add(messageId));
        Alert.alert('Saved', 'Message saved to your collection.');
      } catch (e) {
        Alert.alert('Error', 'Failed to save message.');
      }
    },
    [activeConversation, savedMessageIds]
  );

  const handleLimitReached = useCallback((mode: 'subscription' | 'credits' = 'subscription') => {
    setPaywallType(mode);
    setShowPaywall(true);
  }, []);

  if (activeConversation) {
    return (
      <>
        <ChatView
          conversationId={activeConversation.id}
          conversationTitle={activeConversation.title}
          userId={userId}
          onBack={() => setActiveConversation(null)}
          onSaveMessage={handleSaveMessage}
          initialPrompt={pendingPrompt || undefined}
          onPromptConsumed={() => setPendingPrompt(null)}
          savedMessageIds={savedMessageIds}
          isPremium={isPremium}
          onLimitReached={handleLimitReached}
          category={category}
        />
        <PaywallScreen
          visible={showPaywall}
          onClose={() => setShowPaywall(false)}
          defaultPurchaseType={paywallType}
        />
      </>
    );
  }

  return (
    <>
      <ConversationList
        userId={userId}
        onSelect={(id, title) => setActiveConversation({ id, title })}
        onNew={handleNew}
        onBack={() => navigation.goBack()}
      />
      <PaywallScreen
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        defaultPurchaseType={paywallType}
      />
    </>
  );
}

export default function ChatAIScreen() {
  return (
    <>
      <Unauthenticated>
        <AuthPrompt />
      </Unauthenticated>
      <Authenticated>
        <ChatContent />
      </Authenticated>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  newChatText: {
    ...typography.captionMedium,
    color: colors.textInverse,
  },
  listContent: {
    padding: spacing.lg,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  conversationIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conversationContent: {
    flex: 1,
  },
  conversationTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  conversationTime: {
    ...typography.small,
    color: colors.textTertiary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    ...typography.body,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  signInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    marginTop: spacing.xxl,
  },
  signInButtonText: {
    ...typography.bodyMedium,
    color: colors.textInverse,
  },
  // Chat view styles
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  backButton: {
    padding: spacing.sm,
  },
  chatHeaderContent: {
    flex: 1,
  },
  chatHeaderTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  chatHeaderSubtitle: {
    ...typography.small,
    color: colors.gold,
  },
  messagesContent: {
    padding: spacing.lg,
    flexGrow: 1,
  },
  messageBubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  messageBubbleRowUser: {
    justifyContent: 'flex-end',
  },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.goldMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  userBubble: {
    backgroundColor: colors.surfaceElevated,
    borderBottomRightRadius: spacing.xs,
  },
  aiBubble: {
    backgroundColor: colors.aiBubble,
    borderBottomLeftRadius: spacing.xs,
  },
  messageText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  userMessageText: {
    color: colors.textPrimary,
  },
  saveButton: {
    padding: spacing.xs,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.aiBubble,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  typingText: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  chatEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    gap: spacing.md,
  },
  chatEmptyText: {
    ...typography.body,
    color: colors.textTertiary,
  },
  chatEmptyHint: {
    ...typography.caption,
    color: colors.textTertiary,
    marginBottom: spacing.md,
  },
  suggestionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestionChipText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
    backgroundColor: colors.surface,
  },
  textInput: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.surfaceLight,
  },
  usagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  usagePillText: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  modePills: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginLeft: spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  modeChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeChipActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  modeChipText: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  modeChipTextActive: {
    color: colors.textInverse,
  },
  suggestionsTitle: {
    ...typography.caption,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  suggestionText: {
    ...typography.caption,
    color: colors.textPrimary,
  },
});