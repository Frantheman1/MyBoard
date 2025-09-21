import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Board } from '../../types';
import { getBoardsByOrganizationId, createBoard, deleteBoard } from '../../utils/storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AnimatedTitle from '../../../components/AnimatedTitle';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { Swipeable } from 'react-native-gesture-handler';

export default function DashboardScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const [boards, setBoards] = useState<Board[]>([]);
  const { theme } = useTheme();

  const loadBoards = async () => {
    if (!user) return;
    const data = await getBoardsByOrganizationId(user.organizationId);
    setBoards(data);
  };

  useEffect(() => {
    loadBoards();
  }, [user?.organizationId]);

  useFocusEffect(
    useCallback(() => {
      loadBoards();
    }, [user?.organizationId])
  );

  const handleCreateBoard = async () => {
    if (!user) return;
    try {
      const newBoard = await createBoard({ title: t.dashboard.teamBoard, organizationId: user.organizationId, createdBy: user.id });
      await loadBoards();
      navigation.navigate('Board', { boardId: newBoard.id });
    } catch (e) {
      Alert.alert(t.common.error, t.dashboard.unableCreateBoard);
    }
  };

  const handleDeleteBoard = async (boardId: string, title: string) => {
    if (!user || user.role !== 'admin') {
      Alert.alert(t.common.error, t.dashboard.notAuthorizedDeleteBoard);
      return;
    }
    Alert.alert(t.dashboard.deleteBoardTitle, `${t.dashboard.deleteBoardMessage} "${title}".`,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete,
          style: 'destructive',
          onPress: async () => {
            try {
              // Use the deleteBoard function from storage.ts
              // Assuming it's available and imported, if not, it needs to be added.
              // For now, I'll add a placeholder. It needs to be imported from `../../utils/storage`.
              // I'll add the import for deleteBoard later, after confirming the existence.
              await deleteBoard(boardId);
              await loadBoards();
            } catch (e: any) {
              console.error('Delete board error:', e);
              Alert.alert(t.common.error, e?.message || t.dashboard.unableDeleteBoard);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <LinearGradient
        colors={[theme.colors.primary, theme.colors.primaryAlt]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <AnimatedTitle text={t.dashboard.title} style={[styles.headerTitle, { color: 'white' }]} />
        <Text style={[styles.headerSubtitle, { color: 'rgba(255,255,255,0.85)' }]}>{t.dashboard.welcome}, {user?.name}!</Text>
      </LinearGradient>

      <View style={styles.content}>
        {boards.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>{t.dashboard.noBoardsYet}</Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.secondaryText }]}>
              {user?.role === 'admin' 
                ? t.dashboard.noBoardsAdmin 
                : t.dashboard.noBoardsAdmin}
            </Text>
            {user?.role === 'admin' && (
              <Button title={t.dashboard.createBoard} onPress={handleCreateBoard} />
            )}
          </View>
        ) : (
          <View style={{ flex: 1, width: '100%' }}>
            <FlatList
              data={boards}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingVertical: 16 }}
              renderItem={({ item }) => (
                <Swipeable
                  renderRightActions={() => (
                    <TouchableOpacity onPress={() => handleDeleteBoard(item.id, item.title)}>
                      <View style={styles.deleteButton}>
                        <Text style={styles.deleteButtonText}>{t.dashboard.delete}</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                >
                  <TouchableOpacity onPress={() => navigation.navigate('Board', { boardId: item.id })}>
                    <Card style={[styles.boardItem, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
                      <Text style={[styles.boardTitle, { color: theme.colors.text }]}>{item.title}</Text>
                      <Text style={[styles.boardMeta, { color: theme.colors.secondaryText }]}>{t.dashboard.created}: {new Date(item.createdAt).toLocaleDateString()}</Text>
                    </Card>
                  </TouchableOpacity>
                </Swipeable>
              )}
              ListFooterComponent={user?.role === 'admin' ? (
                <Button title={t.dashboard.createBoard} onPress={handleCreateBoard} style={{ marginTop: 16, alignSelf: 'center' }} />
              ) : null}
            />
            <Text style={[styles.swipeHint, { color: theme.colors.secondaryText }]}>{t.common.swipeToDelete}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 16,
    marginTop: 4,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  boardItem: {
    borderRadius: 16,
    padding: 18,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  boardTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  boardMeta: {
    marginTop: 6,
  },
  emptyState: {
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  deleteButton: {
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
    borderRadius: 16,
    marginBottom: 12,
    marginRight: 20, // Align with board items' marginHorizontal
  },
  deleteButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  swipeHint: {
    textAlign: 'center',
    marginTop: 10,
    fontSize: 12,
    marginBottom: 60,
  },
});
