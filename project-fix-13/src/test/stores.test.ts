/**
 * Store Tests — uiStore, chatStore, terminalStore
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '../store/uiStore';
import { useChatStore } from '../store/chatStore';
import { useTerminalStore } from '../store/terminalStore';

// Reset stores between tests
const resetUI  = () => useUIStore.setState({ view: 'landing', sidebarOpen: true, chatOpen: true, terminalOpen: false, previewOpen: false, activePanel: 'files', mobileMenuOpen: false });
const resetChat = () => useChatStore.setState({ messages: [], isLoading: false });
const resetTerm = () => useTerminalStore.setState({ lines: [] });

describe('useUIStore', () => {
  beforeEach(resetUI);

  it('initial state is landing', () => {
    expect(useUIStore.getState().view).toBe('landing');
  });

  it('setView updates view', () => {
    useUIStore.getState().setView('workspace');
    expect(useUIStore.getState().view).toBe('workspace');
  });

  it('toggleSidebar toggles sidebarOpen', () => {
    expect(useUIStore.getState().sidebarOpen).toBe(true);
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarOpen).toBe(false);
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarOpen).toBe(true);
  });

  it('setActivePanel updates panel', () => {
    useUIStore.getState().setActivePanel('git');
    expect(useUIStore.getState().activePanel).toBe('git');
  });
});

describe('useChatStore', () => {
  beforeEach(resetChat);

  it('starts empty', () => {
    expect(useChatStore.getState().messages).toHaveLength(0);
    expect(useChatStore.getState().isLoading).toBe(false);
  });

  it('addMessage appends', () => {
    useChatStore.getState().addMessage({ role: 'user', content: 'Hello', timestamp: 1 });
    expect(useChatStore.getState().messages).toHaveLength(1);
    expect(useChatStore.getState().messages[0].content).toBe('Hello');
  });

  it('addMessage uses provided id', () => {
    useChatStore.getState().addMessage({ id: 'custom-id', role: 'user', content: 'Hi', timestamp: 1 });
    expect(useChatStore.getState().messages[0].id).toBe('custom-id');
  });

  it('addMessage generates id when not provided', () => {
    useChatStore.getState().addMessage({ role: 'user', content: 'Hi', timestamp: 1 });
    const id = useChatStore.getState().messages[0].id;
    expect(id).toBeTruthy();
    expect(typeof id).toBe('string');
  });

  it('updateMessage patches by id', () => {
    useChatStore.getState().addMessage({ id: 'm1', role: 'user', content: 'Original', timestamp: 1 });
    useChatStore.getState().updateMessage('m1', { content: 'Updated' });
    expect(useChatStore.getState().messages[0].content).toBe('Updated');
  });

  it('clearMessages empties store', () => {
    useChatStore.getState().addMessage({ role: 'user', content: 'Hi', timestamp: 1 });
    useChatStore.getState().clearMessages();
    expect(useChatStore.getState().messages).toHaveLength(0);
  });

  it('setLoading toggles loading', () => {
    useChatStore.getState().setLoading(true);
    expect(useChatStore.getState().isLoading).toBe(true);
    useChatStore.getState().setLoading(false);
    expect(useChatStore.getState().isLoading).toBe(false);
  });
});

describe('useTerminalStore', () => {
  beforeEach(resetTerm);

  it('addLine appends line with id', () => {
    useTerminalStore.getState().addLine({ text: 'Hello', type: 'output', timestamp: 1 });
    const lines = useTerminalStore.getState().lines;
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe('Hello');
    expect(lines[0].id).toBeTruthy();
  });

  it('caps at 2000 lines', () => {
    for (let i = 0; i < 2100; i++) {
      useTerminalStore.getState().addLine({ text: `line ${i}`, type: 'output', timestamp: i });
    }
    expect(useTerminalStore.getState().lines).toHaveLength(2000);
  });

  it('clear empties lines', () => {
    useTerminalStore.getState().addLine({ text: 'x', type: 'output', timestamp: 1 });
    useTerminalStore.getState().clear();
    expect(useTerminalStore.getState().lines).toHaveLength(0);
  });
});
