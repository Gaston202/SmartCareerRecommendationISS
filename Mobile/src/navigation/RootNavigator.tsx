import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthProvider';

import { LoginScreen } from '../screens/auth/LoginScreen';
import { SignupScreen } from '../screens/auth/SignupScreen';

import ProfileScreen from '../screens/ProfileScreen';
import HomeScreen from '../screens/HomeScreen';
import CareersScreen from '../screens/CareersScreen';
import RoadmapsTabScreen from '../screens/RoadmapsTabScreen';
import QuizScreen from '../screens/QuizScreen';
import CareerRoadmapScreen from '../screens/CareerRoadmapScreen';
import LearningRoadmapScreen from '../screens/LearningRoadmapScreen';
import MentorsScreen from '../screens/MentorsScreen';
import { SkillsReviewScreen, CVAnalysisScreen } from '../features/cv';
import { MentorDetailScreen } from '../screens/mentors/MentorDetailScreen';
import { GroupChatsScreen } from '../screens/mentors/GroupChatsScreen';
import { GroupChatScreen } from '../screens/mentors/GroupChatScreen';

import { MentorHomeScreen } from '../screens/mentors/MentorHomeScreen';
import { JobListingsScreen } from '../screens/mentors/JobListingsScreen';
import { MentorSpecialtyGroupChatsScreen } from '../screens/mentors/MentorSpecialtyGroupChatsScreen';
import { MentorSessionsScreen } from '../screens/mentors/MentorSessionsScreen';
import { AvailabilitySettingsScreen } from '../screens/mentors/AvailabilitySettingsScreen';
import { SessionBookingScreen } from '../screens/mentors/SessionBookingScreen';
import { MySessionsScreen } from '../screens/mentors/MySessionsScreen';

import { homeColors } from '../screens/homeTheme';

type AuthStackParamList = {
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
    careerId?: string;
    careerTitle: string;
    careerDescription: string;
    matchPercent?: number;
    tags?: string[];
  };
  LearningRoadmap: {
    careerId?: string;
    careerTitle: string;
    careerDescription: string;
  };
};

type MentorsStackParamList = {
  MentorsList: undefined;
  MentorDetail: { mentorId: string };
  GroupChats: undefined;
  GroupChat: { chatId: string };
  SessionBooking: { mentorId: string; mentorName: string };
  MySessions: undefined;
};

type MentorGroupChatsStackParamList = {
  MentorGroupChats: undefined;
  MentorGroupChatDetail: { chatId: string };
  MentorDetail: { mentorId?: string; userId?: string };
};

type MentorSessionsStackParamList = {
  MentorSessionsMain: undefined;
  AvailabilitySettings: undefined;
};

type CareersStackParamList = {
  CareersList: undefined;
  CareerRoadmap: {
    roadmapId?: string;
    careerId?: string;
    careerTitle: string;
    careerDescription: string;
    matchPercent?: number;
    tags?: string[];
  };
  LearningRoadmap: {
    careerId?: string;
    careerTitle: string;
    careerDescription: string;
  };
};

type RoadmapsStackParamList = {
  RoadmapsList: undefined;
  LearningRoadmap: {
    careerId?: string;
    careerTitle: string;
    careerDescription: string;
  };
};

type ChatsStackParamList = {
  ChatsList: undefined;
  GroupChat: { chatId: string };
  MentorDetail: { mentorId?: string; userId?: string };
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const CareersStack = createNativeStackNavigator<CareersStackParamList>();
const RoadmapsStack = createNativeStackNavigator<RoadmapsStackParamList>();
const MentorsStack = createNativeStackNavigator<MentorsStackParamList>();
const ChatsStack = createNativeStackNavigator<ChatsStackParamList>();
const MentorGroupChatsStack = createNativeStackNavigator<MentorGroupChatsStackParamList>();
const MentorSessionsStack = createNativeStackNavigator<MentorSessionsStackParamList>();
const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();

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
      <HomeStack.Screen name="LearningRoadmap" component={LearningRoadmapScreen} />
    </HomeStack.Navigator>
  );
}

function CareersStackNavigator(): React.ReactElement {
  return (
    <CareersStack.Navigator
      id="CareersStack"
      screenOptions={{ headerShown: false }}
      initialRouteName="CareersList"
    >
      <CareersStack.Screen name="CareersList" component={CareersScreen} />
      <CareersStack.Screen name="CareerRoadmap" component={CareerRoadmapScreen} />
      <CareersStack.Screen name="LearningRoadmap" component={LearningRoadmapScreen} />
    </CareersStack.Navigator>
  );
}

function RoadmapsStackNavigator(): React.ReactElement {
  return (
    <RoadmapsStack.Navigator
      id="RoadmapsStack"
      screenOptions={{ headerShown: false }}
      initialRouteName="RoadmapsList"
    >
      <RoadmapsStack.Screen name="RoadmapsList" component={RoadmapsTabScreen} />
      <RoadmapsStack.Screen name="LearningRoadmap" component={LearningRoadmapScreen} />
    </RoadmapsStack.Navigator>
  );
}

function ChatsStackNavigator(): React.ReactElement {
  return (
    <ChatsStack.Navigator
      id="ChatsStack"
      initialRouteName="ChatsList"
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: homeColors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <ChatsStack.Screen
        name="ChatsList"
        component={GroupChatsScreen}
        options={{ title: 'Group Chats', headerShown: false }}
      />
      <ChatsStack.Screen
        name="GroupChat"
        component={GroupChatScreen}
        options={({ route }) => ({
          title: 'Chat',
          headerShown: false,
        })}
      />
      <ChatsStack.Screen
        name="MentorDetail"
        component={MentorDetailScreen}
        options={{ title: 'Mentor Profile', headerShown: false }}
      />
    </ChatsStack.Navigator>
  );
}

function MentorsStackNavigator(): React.ReactElement {
  return (
    <MentorsStack.Navigator
      id="MentorsStack"
      initialRouteName="MentorsList"
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
        component={MentorsScreen}
        options={{ title: 'Find Mentors', headerShown: false }}
      />
      <MentorsStack.Screen
        name="MentorDetail"
        component={MentorDetailScreen}
        options={{ title: 'Mentor Profile', headerShown: false }}
      />
      <MentorsStack.Screen
        name="SessionBooking"
        component={SessionBookingScreen}
        options={{ title: 'Book Session', headerShown: false }}
      />
      <MentorsStack.Screen
        name="MySessions"
        component={MySessionsScreen}
        options={{ title: 'My Sessions', headerShown: false }}
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
        options={{ title: 'Profile', headerShown: false }}
      />
    </MentorGroupChatsStack.Navigator>
  );
}

function MentorSessionsStackNavigator(): React.ReactElement {
  return (
    <MentorSessionsStack.Navigator
      id="MentorSessionsStack"
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: homeColors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <MentorSessionsStack.Screen
        name="MentorSessionsMain"
        component={MentorSessionsScreen}
        options={{ title: 'Sessions', headerShown: false }}
      />
      <MentorSessionsStack.Screen
        name="AvailabilitySettings"
        component={AvailabilitySettingsScreen}
        options={{ title: 'Availability', headerShown: false }}
      />
    </MentorSessionsStack.Navigator>
  );
}

function MentorTabNavigator(): React.ReactElement {
  return (
    <Tab.Navigator
      id="MentorTabNavigator"
      initialRouteName="MentorHome"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: homeColors.tabActive,
        tabBarInactiveTintColor: homeColors.tabInactive,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;
          if (route.name === 'MentorHome') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'JobSuggestions') {
            iconName = focused ? 'briefcase' : 'briefcase-outline';
          } else if (route.name === 'MentorGroupChats') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else if (route.name === 'MentorSessions') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarLabel: ({ focused, color }: any) => (
          <TabLabel
            focused={focused}
            label={route.name}
            color={color}
          />
        ),
      })}
    >
       <Tab.Screen name="MentorHome" component={MentorHomeScreen} options={{ tabBarLabel: 'Home' }} />
       <Tab.Screen name="MentorGroupChats" component={MentorGroupChatsStackNavigator} options={{ tabBarLabel: 'Chats' }} />
       <Tab.Screen name="MentorSessions" component={MentorSessionsStackNavigator} options={{ tabBarLabel: 'Sessions' }} />
       <Tab.Screen name="JobSuggestions" component={JobListingsScreen} options={{ tabBarLabel: 'Jobs' }} />
    </Tab.Navigator>
  );
}

function UserTabNavigator(): React.ReactElement {
  return (
    <Tab.Navigator
      id="UserTabNavigator"
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: homeColors.tabActive,
        tabBarInactiveTintColor: homeColors.tabInactive,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;
          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Careers') {
            iconName = focused ? 'briefcase' : 'briefcase-outline';
          } else if (route.name === 'Roadmaps') {
            iconName = focused ? 'school' : 'school-outline';
          } else if (route.name === 'Chats') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else if (route.name === 'Mentors') {
            iconName = focused ? 'people' : 'people-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarLabel: ({ focused, color }: any) => (
          <TabLabel
            focused={focused}
            label={route.name}
            color={color}
          />
        ),
      })}
    >
       <Tab.Screen name="Home" component={HomeStackNavigator} />
       <Tab.Screen name="Careers" component={CareersStackNavigator} />
       <Tab.Screen name="Roadmaps" component={RoadmapsStackNavigator} />
       <Tab.Screen name="Chats" component={ChatsStackNavigator} />
       <Tab.Screen name="Mentors" component={MentorsStackNavigator} />
    </Tab.Navigator>
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
        <RootStack.Navigator
          screenOptions={{
            headerShown: false,
          }}
        >
          {isMentor ? (
            <RootStack.Screen name="MentorRoot" component={MentorTabNavigator} options={{ headerShown: false }} />
          ) : (
            <RootStack.Screen name="UserRoot" component={UserTabNavigator} options={{ headerShown: false }} />
          )}
          <RootStack.Group screenOptions={{ presentation: 'modal' }}>
            <RootStack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
          </RootStack.Group>
        </RootStack.Navigator>
      ) : (
        <AuthStack.Navigator
          initialRouteName="Login"
          id="AuthNavigator"
          screenOptions={{
            headerShown: false,
            animation: 'default',
          }}
        >
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen name="Signup" component={SignupScreen} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}
