interface NumberMeaning {
  archetype: string;
  overview: string;
  strengths: string[];
  shadows: string[];
  journalPrompt: string;
  keywords: string[];
  color: string; // Tailwind bg class for accent dot
}

export const NUMEROLOGY_MEANINGS: Record<number, NumberMeaning> = {
  1: {
    archetype: 'The Pioneer',
    overview: 'Number 1 carries the energy of beginnings, independence, and self-determination. In modern numerology it is associated with leadership, initiative, and the courage to forge a new path. As a Life Path it suggests a journey centered on developing individuality and confidence; as an Expression number it points toward roles where originality and self-reliance are assets.',
    strengths: ['Leadership', 'Independence', 'Originality', 'Ambition', 'Courage'],
    shadows: ['Isolation', 'Impatience', 'Stubbornness', 'Difficulty collaborating'],
    journalPrompt: 'Where in your life are you being called to take the lead, and what holds you back from stepping forward?',
    keywords: ['Beginnings', 'Self', 'Initiative', 'Drive'],
    color: 'bg-primary',
  },
  2: {
    archetype: 'The Peacemaker',
    overview: 'Number 2 is associated with cooperation, sensitivity, and the art of partnership. Modern numerology connects it with diplomacy, empathy, and the ability to hold space for others. As a Life Path it suggests a journey of learning to balance personal needs with the needs of relationships; as a Soul Urge it may point to a deep inner longing for harmony and connection.',
    strengths: ['Empathy', 'Diplomacy', 'Patience', 'Intuition', 'Cooperation'],
    shadows: ['Indecision', 'Over-sensitivity', 'People-pleasing', 'Difficulty with boundaries'],
    journalPrompt: 'How do you balance your own needs with the needs of those you care for? Where might you need to set a clearer boundary?',
    keywords: ['Partnership', 'Balance', 'Harmony', 'Sensitivity'],
    color: 'bg-accent',
  },
  3: {
    archetype: 'The Creator',
    overview: 'Number 3 is linked to self-expression, creativity, and communication. In modern numerology it is associated with joy, imagination, and the ability to uplift others through art, words, or humor. As a Life Path it suggests a journey of learning to channel creative energy with focus; as an Expression number it often appears in people drawn to artistic or communicative work.',
    strengths: ['Creativity', 'Communication', 'Optimism', 'Charm', 'Imagination'],
    shadows: ['Scattered focus', 'Superficiality', 'Moodiness', 'Difficulty with follow-through'],
    journalPrompt: 'What creative project or form of expression have you been putting off? What would it feel like to begin it today?',
    keywords: ['Expression', 'Joy', 'Creativity', 'Communication'],
    color: 'bg-secondary',
  },
  4: {
    archetype: 'The Builder',
    overview: 'Number 4 is associated with structure, discipline, and the patient work of building something lasting. Modern numerology connects it with reliability, practicality, and a methodical approach to life. As a Life Path it suggests a journey of learning to create stable foundations; as a Personality number it may indicate someone others perceive as dependable and grounded.',
    strengths: ['Discipline', 'Reliability', 'Organization', 'Loyalty', 'Practicality'],
    shadows: ['Rigidity', 'Resistance to change', 'Overwork', 'Difficulty with spontaneity'],
    journalPrompt: 'What routine supports you most right now, and where could you allow a little more flexibility or play?',
    keywords: ['Structure', 'Foundation', 'Work', 'Stability'],
    color: 'bg-primary',
  },
  5: {
    archetype: 'The Explorer',
    overview: 'Number 5 is linked to freedom, adaptability, and a love of experience. In modern numerology it is associated with curiosity, versatility, and a restless desire to learn through direct engagement with the world. As a Life Path it suggests a journey of learning to channel freedom-seeking energy constructively; as a Soul Urge it may point to a deep inner need for variety and independence.',
    strengths: ['Adaptability', 'Curiosity', 'Versatility', 'Charisma', 'Resourcefulness'],
    shadows: ['Restlessness', 'Impulsiveness', 'Difficulty with commitment', 'Overindulgence'],
    journalPrompt: 'What new experience or area of learning is calling to you? How might you explore it in a grounded, sustainable way?',
    keywords: ['Freedom', 'Change', 'Adventure', 'Versatility'],
    color: 'bg-accent',
  },
  6: {
    archetype: 'The Nurturer',
    overview: 'Number 6 is associated with care, responsibility, and the creation of harmony in home and community. Modern numerology connects it with compassion, service, and a strong sense of duty toward others. As a Life Path it suggests a journey of learning to give generously without losing oneself; as an Expression number it often appears in people drawn to healing, teaching, or caregiving roles.',
    strengths: ['Compassion', 'Responsibility', 'Healing', 'Creativity', 'Loyalty'],
    shadows: ['Perfectionism', 'Self-sacrifice', 'Worry', 'Difficulty accepting help'],
    journalPrompt: 'Where are you giving more than you have? What would it look like to care for yourself with the same generosity you offer others?',
    keywords: ['Care', 'Harmony', 'Responsibility', 'Service'],
    color: 'bg-secondary',
  },
  7: {
    archetype: 'The Seeker',
    overview: 'Number 7 is linked to introspection, analysis, and the pursuit of deeper understanding. In modern numerology it is associated with wisdom, spiritual inquiry, and a preference for depth over surface. As a Life Path it suggests a journey of learning to trust both intellect and intuition; as a Soul Urge it may point to a deep inner need for solitude and meaning.',
    strengths: ['Intuition', 'Analysis', 'Wisdom', 'Depth', 'Spiritual awareness'],
    shadows: ['Isolation', 'Secrecy', 'Overthinking', 'Difficulty with vulnerability'],
    journalPrompt: 'What question have you been sitting with lately? What would it mean to trust your intuition alongside your analysis?',
    keywords: ['Wisdom', 'Introspection', 'Mystery', 'Inquiry'],
    color: 'bg-primary',
  },
  8: {
    archetype: 'The Achiever',
    overview: 'Number 8 is associated with ambition, authority, and the mastery of material and organizational challenges. Modern numerology connects it with business acumen, resilience, and the ability to work effectively within systems of power. As a Life Path it suggests a journey of learning to use influence wisely; as an Expression number it often appears in people drawn to leadership, finance, or large-scale projects.',
    strengths: ['Ambition', 'Authority', 'Resilience', 'Organization', 'Strategic thinking'],
    shadows: ['Materialism', 'Control', 'Overwork', 'Difficulty delegating'],
    journalPrompt: 'How do you relate to power and success? Where might you be working harder than necessary, and what would it mean to trust others more?',
    keywords: ['Power', 'Ambition', 'Achievement', 'Authority'],
    color: 'bg-accent',
  },
  9: {
    archetype: 'The Humanitarian',
    overview: 'Number 9 is linked to compassion, completion, and a broad concern for humanity. In modern numerology it is associated with idealism, generosity, and the wisdom that comes from experience. As a Life Path it suggests a journey of learning to give without expectation and to release what no longer serves; as a Soul Urge it may point to a deep inner longing to contribute to something larger than oneself.',
    strengths: ['Compassion', 'Generosity', 'Wisdom', 'Idealism', 'Creativity'],
    shadows: ['Martyrdom', 'Impracticality', 'Difficulty receiving', 'Emotional intensity'],
    journalPrompt: 'What are you ready to release or complete? How might letting go of something old create space for something new?',
    keywords: ['Completion', 'Compassion', 'Wisdom', 'Service'],
    color: 'bg-secondary',
  },
  11: {
    archetype: 'The Intuitive',
    overview: 'In modern numerology, 11 is called a master number — a number that is not reduced further in most schools of thought, though conventions vary. It is associated with heightened intuition, inspiration, and a sensitivity that can be both a gift and a challenge. Note that not all numerology traditions recognize master numbers, and those that do may handle them differently. As a Life Path it suggests a journey of learning to channel sensitivity into creative or spiritual contribution.',
    strengths: ['Intuition', 'Inspiration', 'Empathy', 'Spiritual awareness', 'Creativity'],
    shadows: ['Anxiety', 'Overwhelm', 'High sensitivity', 'Difficulty with practical matters'],
    journalPrompt: 'When do you feel most in tune with your intuition? What helps you stay grounded when your sensitivity feels overwhelming?',
    keywords: ['Intuition', 'Inspiration', 'Sensitivity', 'Vision'],
    color: 'bg-primary',
  },
  22: {
    archetype: 'The Master Builder',
    overview: 'In modern numerology, 22 is called a master number associated with the ability to translate large visions into practical reality. Like all master numbers, its recognition varies by tradition. As a Life Path it suggests a journey of learning to balance grand ambition with the patience and discipline required to build something lasting. The pressure associated with this number in popular numerology is a contemporary interpretation, not an ancient teaching.',
    strengths: ['Vision', 'Practicality', 'Leadership', 'Discipline', 'Manifestation'],
    shadows: ['Perfectionism', 'Pressure', 'Overwhelm', 'Difficulty starting'],
    journalPrompt: 'What large vision are you working toward? What one practical step could you take this week to move it forward?',
    keywords: ['Vision', 'Manifestation', 'Discipline', 'Legacy'],
    color: 'bg-accent',
  },
  33: {
    archetype: 'The Teacher',
    overview: 'In modern numerology, 33 is sometimes called a master number associated with compassion, teaching, and selfless service. It is the rarest of the commonly recognized master numbers, and many numerologists only count it when it appears as a final Life Path result — not as an intermediate sum. As with all master numbers, traditions differ significantly on whether and how to recognize it.',
    strengths: ['Compassion', 'Teaching', 'Healing', 'Selflessness', 'Creativity'],
    shadows: ['Self-sacrifice', 'Idealism', 'Burnout', 'Difficulty with personal needs'],
    journalPrompt: 'How do you balance service to others with care for yourself? Where might you be giving from an empty cup?',
    keywords: ['Service', 'Compassion', 'Teaching', 'Healing'],
    color: 'bg-secondary',
  },
};
