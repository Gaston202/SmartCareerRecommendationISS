import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthProvider';

import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignupScreen } from '../screens/auth/SignupScreen';

import ProfileScreen from '../screens/ProfileScreen';
import HomeScreen from '../screens/HomeScreen';
import RoadmapsScreen from '../screens/RoadmapsScreen';
import QuizScreen from '../screens/QuizScreen';
import CareerRoadmapScreen from '../screens/CareerRoadmapScreen';
import { SkillsReviewScreen, CVAnalysisScreen } from '../features/cv';
import { MentorsListScreen } from '../screens/mentors/MentorsListScreen';
import { MentorDetailScreen } from '../screens/mentors/MentorDetailScreen';
import { GroupChatsScreen } from '../screens/mentors/GroupChatsScreen';
import { GroupChatScreen } from '../screens/mentors/GroupChatScreen';

import { MentorHomeScreen } from '../screens/mentors/MentorHomeScreen';
import { JobListingsScreen } from '../screens/mentors/JobListingsScreen';
import { MentorSpecialtyGroupChatsScreen } from '../screens/mentors/MentorSpecialtyGroupChatsScreen';

import { homeColors } from '../screens/homeTheme';

type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Signup: undefined;
};

type HomeStackParamList = {
  HomeMain: undefined;
  Quiz: undefined;
  SkillsReview: undefined;
  CVAnalysis: undefined;
  CareerRoadmap: {
    roadmapId?: string;
    careerTitle: string;
    careerDescription: string;
    matchPercent?: number;
    tags?: string[];
  };
};

type MentorsStackParamList = {
  MentorsList: undefined;
  MentorDetail: { mentorId: string };
  GroupChats: undefined;
  GroupChat: { chatId: string };
};

type MentorGroupChatsStackParamList = {
  MentorGroupChats: undefined;
  MentorGroupChatDetail: { chatId: string };
  MentorDetail: { mentorId?: string; userId?: string };
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const MentorsStack = createNativeStackNavigator<MentorsStackParamList>();
const MentorGroupChatsStack = createNativeStackNavigator<MentorGroupChatsStackParamList>();
const Tab = createBottomTabNavigator();

function HomeStackNavigator(): React.ReactElement {
  return (
    <HomeStack.Navigator
      id="HomeStack"
      screenOptions={{ headerShown: false }}
      initialRouteName="HomeMain"
    >
      <HomeStack.Screen name="HomeMain" component={HomeScreen} />
      <HomeStack.Screen name="Quiz" component={QuizScreen} />
      <HomeStack.Screen name="SkillsReview" component={SkillsReviewScreen} />
      <HomeStack.Screen name="CVAnalysis" component={CVAnalysisScreen} />
      <HomeStack.Screen name="CareerRoadmap" component={CareerRoadmapScreen} />
    </HomeStack.Navigator>
  );
}

function MentorsStackNavigator(): React.ReactElement {
  return (
    <MentorsStack.Navigator
      id="MentorsStack"
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: homeColors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <MentorsStack.Screen
        name="GroupChats"
        component={GroupChatsScreen}
        options={{ title: 'Group Chats', headerShown: false }}
      />
      <MentorsStack.Screen
        name="GroupChat"
        component={GroupChatScreen}
        options={({ route }) => ({
          title: 'Chat',
          headerShown: false,
        })}
      />
      <MentorsStack.Screen
        name="MentorsList"
        component={MentorsListScreen}
        options={{ title: 'Find Mentors', headerShown: false }}
      />
      <MentorsStack.Screen
        name="MentorDetail"
        component={MentorDetailScreen}
        options={{ title: 'Mentor Profile' }}
      />
    </MentorsStack.Navigator>
  );
}

function MentorGroupChatsStackNavigator(): React.ReactElement {
  return (
    <MentorGroupChatsStack.Navigator
      id="MentorGroupChatsStack"
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: homeColors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <MentorGroupChatsStack.Screen
        name="MentorGroupChats"
        component={MentorSpecialtyGroupChatsScreen}
        options={{ title: 'Group Chats', headerShown: false }}
      />
      <MentorGroupChatsStack.Screen
        name="MentorGroupChatDetail"
        component={GroupChatScreen}
        options={({ route }) => ({
          title: 'Chat',
          headerShown: false,
        })}
      />
      <MentorGroupChatsStack.Screen
        name="MentorDetail"
        component={MentorDetailScreen}
        options={{ title: 'Profile' }}
      />
    </MentorGroupChatsStack.Navigator>
  );
}

function TabLabel({
  focused,
  label,
  color,
}: {
  focused: boolean;
  label: string;
  color: string;
}) {
  return (
    <View style={tabLabelStyles.wrap}>
      <Text style={[tabLabelStyles.text, { color }]}>{label}</Text>
      {focused && <View style={[tabLabelStyles.dot, { backgroundColor: color }]} />}
    </View>
  );
}

const tabLabelStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 4,
  },
});

const TAB_BAR_BASE_HEIGHT = 60;

export function RootNavigator(): React.ReactElement {
  const { state } = useAuth();
  const insets = useSafeAreaInsets();

  if (state.isLoading) {
    return <View />;
  }

  const isSignedIn = !!state.user && !!state.session;
  const isMentor = state.user?.role === 'mentor';
  const tabBarHeight = TAB_BAR_BASE_HEIGHT + insets.bottom;
  const tabBarPaddingTop = 8;
  const tabBarPaddingBottom = Math.max(insets.bottom, 8);

  const sharedTabOptions = ({ route }: any) => ({
    headerShown: false,
    tabBarHideOnKeyboard: true,
    tabBarActiveTintColor: homeColors.tabActive,
    tabBarInactiveTintColor: homeColors.tabInactive,
    tabBarStyle: {
      height: tabBarHeight,
      paddingBottom: tabBarPaddingBottom,
      paddingTop: tabBarPaddingTop,
      backgroundColor: homeColors.tabBarBg,
    },
    tabBarLabel: ({ focused, color }: any) => (
      <TabLabel
        focused={focused}
        label={route.name}
        color={color}
      />
    ),
  });

  return (
    <NavigationContainer>
      {isSignedIn ? (
        isMentor ? (
          <Tab.Navigator
            id="MentorTabNavigator"
            initialRouteName="MentorHome"
            screenOptions={({ route }) => ({
              ...sharedTabOptions({ route }),
              tabBarIcon: ({ focused, color, size }) => {
                let iconName: keyof typeof Ionicons.glyphMap;
                if (route.name === 'MentorHome') {
                  iconName = focused ? 'home' : 'home-outline';
                } else if (route.name === 'JobSuggestions') {
                  iconName = focused ? 'briefcase' : 'briefcase-outline';
                } else if (route.name === 'MentorGroupChats') {
                  iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
                } else {
                  iconName = focused ? 'person' : 'person-outline';
                }
                return <Ionicons name={iconName} size={size} color={color} />;
              },
            })}
          >
            <Tab.Screen name="MentorHome" component={MentorHomeScreen} options={{ tabBarLabel: 'Home' }} />
            <Tab.Screen name="MentorGroupChats" component={MentorGroupChatsStackNavigator} options={{ tabBarLabel: 'Chats' }} />
            <Tab.Screen name="JobSuggestions" component={JobListingsScreen} options={{ tabBarLabel: 'Jobs' }} />
            <Tab.Screen name="Profile" component={ProfileScreen} />
          </Tab.Navigator>
        ) : (
          <Tab.Navigator
            id="UserTabNavigator"
            initialRouteName="Home"
            screenOptions={({ route }) => ({
              ...sharedTabOptions({ route }),
              tabBarIcon: ({ focused, color, size }) => {
                let iconName: keyof typeof Ionicons.glyphMap;
                if (route.name === 'Home') {
                  iconName = focused ? 'home' : 'home-outline';
                } else if (route.name === 'Roadmaps') {
                  iconName = focused ? 'map' : 'map-outline';
                } else if (route.name === 'Mentors') {
                  iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
                } else {
                  iconName = focused ? 'person' : 'person-outline';
                }
                return <Ionicons name={iconName} size={size} color={color} />;
              },
            })}
          >
            <Tab.Screen name="Home" component={HomeStackNavigator} />
            <Tab.Screen name="Roadmaps" component={RoadmapsScreen} />
            <Tab.Screen name="Mentors" component={MentorsStackNavigator} />
            <Tab.Screen name="Profile" component={ProfileScreen} />
          </Tab.Navigator>
        )
      ) : (
        <AuthStack.Navigator
          id="AuthNavigator"
          screenOptions={{
            headerShown: false,
            animation: 'default',
          }}
        >
          <AuthStack.Screen
            name="Welcome"
            component={WelcomeScreen}
            options={{ animation: 'none' }}
          />
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen name="Signup" component={SignupScreen} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}
