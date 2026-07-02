import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { Redirect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import tw from 'twrnc';

export default function Index() {
  const [isReady, setIsReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState<string | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const session = await SecureStore.getItemAsync('_parent_session');
        if (session) {
          setInitialRoute('/(tabs)/dashboard');
        } else {
          setInitialRoute('/login');
        }
      } catch (e) {
        setInitialRoute('/login');
      } finally {
        setIsReady(true);
      }
    };

    checkSession();
  }, []);

  if (!isReady || !initialRoute) {
    return (
      <View style={tw`flex-1 justify-center items-center bg-slate-50`}>
        <Text>Ini Index.tsx (isReady: {isReady ? 'true' : 'false'})</Text>
        <ActivityIndicator size="large" color="red" />
      </View>
    );
  }

  return <Redirect href={initialRoute as any} />;
}
