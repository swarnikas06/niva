export type PrimaryFocus =
  | 'technical_placement'
  | 'deep_work'
  | 'academic_learning'
  | 'general_growth';

export type ProactivityLevel = 'low' | 'medium' | 'high';

export type ResponseLength = 'concise' | 'balanced' | 'thorough';

export type OnboardingStep =
  | 'identity'
  | 'focus'
  | 'archetype'
  | 'tone'
  | 'completed'
  | 'skipped';

export interface ArchetypeTraits {
  warmth: number; // 1-100
  directness: number; // 1-100
  humor: number; // 1-100
  challengeLevel: number; // 1-100
  proactivity: ProactivityLevel;
  responseLength: ResponseLength;
}

export interface SampleDialogue {
  user: string;
  companion: string;
}

export interface CharacterVoicePreference {
  lang?: string;
  pitch?: number;
  rate?: number;
  genderHint?: 'male' | 'female' | 'neutral';
  preferredVoiceName?: string;
}

export interface CharacterArchetypeDto {
  id: string;
  name: string;
  tagline: string;
  description: string;
  detailedPersonality?: string;
  communicationStyle?: string;
  preferredStructure?: string;
  accentColor?: string;
  avatarId?: string;
  voicePreference?: CharacterVoicePreference;
  traits: ArchetypeTraits;
  sampleDialogue: SampleDialogue[];
  isActive: boolean;
  sortOrder: number;
}

export interface UserPersonalizationDto {
  id: string | null;
  userId: string;
  preferredName: string | null;
  occupationRole: string | null;
  primaryFocus: PrimaryFocus | null;
  selectedArchetypeId: string;
  warmth: number; // 1-100
  directness: number; // 1-100
  humor: number; // 1-100
  challengeLevel: number; // 1-100
  proactivity: ProactivityLevel;
  responseLength: ResponseLength;
  onboardingCompleted: boolean;
  onboardingStep: OnboardingStep;
  onboardedAt: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface UserEducationProfile {
  institution?: string;
  degree?: string;
  fieldOfStudy?: string;
  graduationYear?: number;
}

export interface UserProfessionProfile {
  currentRole?: string;
  company?: string;
  industry?: string;
  yearsExperience?: number;
  targetRole?: string;
}

export interface UserDailyRoutines {
  wakeTime?: string;
  sleepTime?: string;
  peakFocusHours?: string;
  workoutTime?: string;
}

export interface UserCommunicationPreferences {
  format?: 'concise' | 'balanced' | 'bullet_points';
  directness?: 'low' | 'moderate' | 'high';
  tone?: string;
  proactiveFrequency?: 'low' | 'moderate' | 'high';
}

export interface UserLearningPreferences {
  style?: 'first_principles' | 'applied_examples' | 'active_recall';
  pace?: string;
}

export interface UserOngoingChallenge {
  challenge: string;
  context?: string;
  severity?: 'low' | 'medium' | 'high';
}

export interface UserImportantDate {
  label: string;
  date: string; // YYYY-MM-DD or ISO
  recurrence?: 'yearly' | 'monthly' | 'once';
}

export interface AttributeConfidenceMetadata {
  confidence: number; // 0.0 - 1.0
  confidenceType: 'explicit' | 'inferred';
  provenance: string;
  updatedAt: string;
}

export interface UserProfileDto {
  id: string;
  userId: string;
  education: UserEducationProfile;
  profession: UserProfessionProfile;
  expertiseAreas: string[];
  interests: string[];
  dailyRoutines: UserDailyRoutines;
  communicationPreferences: UserCommunicationPreferences;
  learningPreferences: UserLearningPreferences;
  ongoingChallenges: UserOngoingChallenge[];
  importantDates: UserImportantDate[];
  attributeConfidence: Record<string, AttributeConfidenceMetadata>;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateUserProfileDto {
  education?: Partial<UserEducationProfile>;
  profession?: Partial<UserProfessionProfile>;
  expertiseAreas?: string[];
  interests?: string[];
  dailyRoutines?: Partial<UserDailyRoutines>;
  communicationPreferences?: Partial<UserCommunicationPreferences>;
  learningPreferences?: Partial<UserLearningPreferences>;
  ongoingChallenges?: UserOngoingChallenge[];
  importantDates?: UserImportantDate[];
}

export interface OnboardingUpdateRequestDto {
  step: OnboardingStep;
  preferredName?: string;
  occupationRole?: string;
  primaryFocus?: PrimaryFocus;
  selectedArchetypeId?: string;
  warmth?: number; // 1-100 scale on API
  directness?: number; // 1-100 scale on API
  humor?: number; // 1-100 scale on API
  challengeLevel?: number; // 1-100 scale on API
  proactivity?: ProactivityLevel;
  responseLength?: ResponseLength;
  complete?: boolean;
  skip?: boolean;
}

export interface PersonalizationUpdateRequestDto {
  preferredName?: string;
  occupationRole?: string;
  primaryFocus?: PrimaryFocus;
  selectedArchetypeId?: string;
  warmth?: number;
  directness?: number;
  humor?: number;
  challengeLevel?: number;
  proactivity?: ProactivityLevel;
  responseLength?: ResponseLength;
}
