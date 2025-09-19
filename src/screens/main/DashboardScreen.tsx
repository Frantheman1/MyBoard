import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Board } from '../../types';
import { getBoardsByOrganizationId, createBoard } from '../../utils/storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AnimatedTitle from '../../../components/AnimatedTitle';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../contexts/ThemeContext';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';

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
                <TouchableOpacity onPress={() => navigation.navigate('Board', { boardId: item.id })}>
                  <Card style={[styles.boardItem, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
                    <Text style={[styles.boardTitle, { color: theme.colors.text }]}>{item.title}</Text>
                    <Text style={[styles.boardMeta, { color: theme.colors.secondaryText }]}>{t.dashboard.created}: {new Date(item.createdAt).toLocaleDateString()}</Text>
                  </Card>
                </TouchableOpacity>
              )}
              ListFooterComponent={user?.role === 'admin' ? (
                <Button title={t.dashboard.createBoard} onPress={handleCreateBoard} style={{ marginTop: 16, alignSelf: 'center' }} />
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
});
