import { useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTripAssistant, type ChatMessage } from '../../../src/useTripAssistant';
import { theme } from '../../../src/theme';

// F16: the mobile AI trip assistant screen — NL Q&A + agentic edits, streaming over SignalR. Mirrors
// the web floating panel. Edits the assistant makes refresh the itinerary screen on focus (its
// useFocusEffect / collaboration refetch).
export default function AssistantScreen() {
  const { t } = useTranslation();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { messages, status, send } = useTripAssistant(tripId!);
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const streaming = status === 'streaming';

  function onSend() {
    const text = input;
    setInput('');
    void send(text).then(() => listRef.current?.scrollToEnd({ animated: true }));
    listRef.current?.scrollToEnd({ animated: true });
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: t('assistant.title') }} />

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={<Text style={styles.empty}>{t('assistant.empty')}</Text>}
        renderItem={({ item, index }) => (
          <View
            style={[
              styles.bubble,
              item.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant,
            ]}
          >
            <Text style={item.role === 'user' ? styles.textUser : styles.textAssistant}>
              {item.content ||
                (streaming && index === messages.length - 1 ? t('assistant.thinking') : '')}
            </Text>
          </View>
        )}
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={t('assistant.placeholder')}
          placeholderTextColor={theme.border}
          editable={!streaming}
          onSubmitEditing={onSend}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.send, (streaming || input.trim().length === 0) && styles.sendDisabled]}
          onPress={onSend}
          disabled={streaming || input.trim().length === 0}
        >
          <Text style={styles.sendText}>{t('assistant.send')}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  list: { padding: 14, gap: 10, flexGrow: 1 },
  empty: { color: theme.text, opacity: 0.7, textAlign: 'center', marginTop: 40, fontSize: 14 },
  bubble: { maxWidth: '85%', paddingVertical: 9, paddingHorizontal: 12, borderRadius: 12 },
  bubbleUser: { alignSelf: 'flex-end', backgroundColor: theme.accent, borderBottomRightRadius: 3 },
  bubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderBottomLeftRadius: 3,
  },
  textUser: { color: '#fff', fontSize: 14, lineHeight: 20 },
  textAssistant: { color: theme.text, fontSize: 14, lineHeight: 20 },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 9,
    color: theme.text,
    backgroundColor: theme.bg,
  },
  send: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: theme.accent,
  },
  sendDisabled: { opacity: 0.5 },
  sendText: { color: '#fff', fontWeight: '700' },
});
