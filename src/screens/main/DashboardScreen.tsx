import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Board } from '../../types';
import { getBoardsByOrganizationId, createBoard } from '../../utils/storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AnimatedTitle from '../../../components/AnimatedTitle';

export default function DashboardScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigation = useNavigation<any>();
  const [boards, setBoards] = useState<Board[]>([]);

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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <AnimatedTitle text={t.dashboard.title} style={styles.headerTitle} />
        <Text style={styles.headerSubtitle}>{t.dashboard.welcome}, {user?.name}!</Text>
      </View>

      <View style={styles.content}>
        {boards.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{t.dashboard.noBoardsYet}</Text>
            <Text style={styles.emptySubtitle}>
              {user?.role === 'admin' 
                ? t.dashboard.noBoardsAdmin 
                : t.dashboard.noBoardsAdmin}
            </Text>
            {user?.role === 'admin' && (
              <TouchableOpacity style={styles.createButton} onPress={handleCreateBoard}>
                <Text style={styles.createButtonText}>{t.dashboard.createBoard}</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={{ flex: 1, width: '100%' }}>
            <FlatList
              data={boards}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingVertical: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.boardItem} onPress={() => navigation.navigate('Board', { boardId: item.id })}>
                  <Text style={styles.boardTitle}>{item.title}</Text>
                  <Text style={styles.boardMeta}>{t.dashboard.created}: {new Date(item.createdAt).toLocaleDateString()}</Text>
                </TouchableOpacity>
              )}
              ListFooterComponent={user?.role === 'admin' ? (
                <TouchableOpacity style={[styles.createButton, { marginTop: 16, alignSelf: 'center' }]} onPress={handleCreateBoard}>
                  <Text style={styles.createButtonText}>{t.dashboard.createBoard}</Text>
                </TouchableOpacity>
              ) : null}
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 4,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  boardItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  boardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  boardMeta: {
    marginTop: 6,
    color: '#6b7280',
  },
  emptyState: {
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
