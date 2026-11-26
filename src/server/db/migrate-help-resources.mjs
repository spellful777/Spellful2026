/**
 * Migration: Spellful Community — Help & Resources tables
 * Creates community_rules, community_rule_acknowledgments,
 * community_faq, community_glossary tables.
 * Safe to re-run — every CREATE uses IF NOT EXISTS.
 */
import { createConnection } from 'mysql2/promise';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const configPath = join(process.env.NOMAD_TASK_DIR || '/local', 'config.json');
// eslint-disable-next-line security/detect-non-literal-fs-filename
const cfg = JSON.parse(readFileSync(configPath, 'utf-8')).DATABASE.VALUE;

const conn = await createConnection({
  host: cfg.HOST, user: cfg.USERNAME, password: cfg.PASSWORD,
  database: cfg.NAME, port: parseInt(cfg.PORT),
  ssl: { rejectUnauthorized: false },
  multipleStatements: true,
});

const run = async (label, sql) => {
  try { await conn.execute(sql); console.log('OK:', label); }
  catch (e) { console.log('ERR:', label, (e.message || String(e)).slice(0, 120)); }
};

// ── Community Rules (versioned) ───────────────────────────────────────────────
await run('community_rules', `
  CREATE TABLE IF NOT EXISTS community_rules (
    id INT PRIMARY KEY AUTO_INCREMENT,
    version VARCHAR(20) NOT NULL,
    title VARCHAR(200) NOT NULL,
    effective_date DATE NOT NULL,
    summary TEXT NOT NULL,
    body LONGTEXT NOT NULL,
    is_current BOOLEAN DEFAULT FALSE,
    created_by VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_current (is_current),
    INDEX idx_version (version)
  )
`);

// ── Rule Acknowledgments ──────────────────────────────────────────────────────
await run('community_rule_acknowledgments', `
  CREATE TABLE IF NOT EXISTS community_rule_acknowledgments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id VARCHAR(36) NOT NULL,
    rule_version VARCHAR(20) NOT NULL,
    acknowledged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_ack (user_id, rule_version),
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
    INDEX idx_user (user_id)
  )
`);

// ── FAQ ───────────────────────────────────────────────────────────────────────
await run('community_faq', `
  CREATE TABLE IF NOT EXISTS community_faq (
    id INT PRIMARY KEY AUTO_INCREMENT,
    category VARCHAR(100) NOT NULL,
    question VARCHAR(500) NOT NULL,
    answer LONGTEXT NOT NULL,
    sort_order INT DEFAULT 0,
    is_published BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_published (is_published),
    FULLTEXT INDEX ft_faq (question, answer)
  )
`);

// ── Glossary ──────────────────────────────────────────────────────────────────
await run('community_glossary', `
  CREATE TABLE IF NOT EXISTS community_glossary (
    id INT PRIMARY KEY AUTO_INCREMENT,
    term VARCHAR(200) NOT NULL,
    term_normalized VARCHAR(200) NOT NULL,
    category VARCHAR(100) NOT NULL,
    definition LONGTEXT NOT NULL,
    tradition_notes TEXT,
    related_terms JSON,
    is_published BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_term (term_normalized),
    INDEX idx_published (is_published),
    FULLTEXT INDEX ft_glossary (term, definition)
  )
`);

// ── Seed: Community Rules v1.0 ────────────────────────────────────────────────
await run('seed community_rules v1.0', `
  INSERT IGNORE INTO community_rules (version, title, effective_date, summary, body, is_current)
  VALUES (
    '1.0',
    'Spellful Community Code',
    '2026-11-25',
    'Our community is built on respect, curiosity, and the shared love of witchcraft and spiritual practice. These rules exist to keep Spellful a welcoming, safe space for practitioners of all paths and experience levels.',
    '## 1. Respect All Paths\n\nSpellful is home to practitioners of every tradition — Wicca, Traditional Witchcraft, Heathenry, Hellenism, Eclectic, Secular, and many more. No single path is more valid than another. Avoid claiming your practice is the only correct way, and never dismiss or belittle another member\'s spiritual beliefs.\n\n## 2. No Gatekeeping\n\nEvery witch was a beginner once. Experienced practitioners are encouraged to share knowledge generously. Do not gatekeep access to information, tools, or community spaces based on experience level, tradition, or how someone identifies their practice.\n\n## 3. Consent and Boundaries\n\nAlways obtain consent before performing spells, rituals, or energy work on behalf of another person. Respect when someone declines or sets a boundary. This applies to both magical workings and personal interactions in the community.\n\n## 4. No Harassment or Discrimination\n\nHarassment of any kind is not tolerated. This includes targeted messages, pile-ons, doxxing, threats, and persistent unwanted contact. Discrimination based on race, ethnicity, gender, gender identity, sexual orientation, disability, religion, age, or body size will result in immediate removal.\n\n## 5. Privacy\n\nDo not share another member\'s personal information without their explicit consent. This includes real names, locations, photos, or any identifying details they have not chosen to make public. Respect the privacy settings members have chosen on their profiles.\n\n## 6. Responsible Sharing\n\nShare information thoughtfully. Clearly distinguish personal experience from established practice. When sharing health, medical, or safety-related information, encourage members to consult qualified professionals. Do not present personal gnosis as universal fact.\n\n## 7. No Scams or Predatory Behaviour\n\nDo not solicit money, payment, or personal information from other members under the guise of spiritual services, readings, or spells. Paid services must be disclosed clearly and honestly. Report any member who pressures others for payment or personal details.\n\n## 8. Cultural Sensitivity\n\nBe mindful of practices that originate in specific cultural or religious traditions. Engage with closed practices respectfully and educate yourself before adopting elements from traditions not your own. Discussions about cultural appropriation are welcome when conducted respectfully.\n\n## 9. Safe Practices\n\nWhen sharing spells, rituals, or herbal information, include relevant safety notes. Do not encourage practices that could cause physical, psychological, or spiritual harm. If you are concerned about a member\'s wellbeing, use the report function or contact a moderator privately.\n\n## 10. No Spam\n\nDo not post repetitive, off-topic, or promotional content. Self-promotion is permitted in designated spaces only. Automated posting, link farming, and unsolicited advertising will result in removal.\n\n---\n\n*Violations of this Code may result in content removal, temporary suspension, or permanent removal from the community depending on severity. Moderators apply these rules with context and good judgement. If you believe a moderation decision was made in error, you may submit an appeal.*',
    TRUE
  )
`);

// ── Seed: FAQ ─────────────────────────────────────────────────────────────────
const faqRows = [
  // Getting Started
  ['Getting Started', 'What is Spellful?', 'Spellful is a witchcraft and spiritual practice platform where you can explore tarot, moon cycles, astrology, spells, herbs, crystals, and connect with a community of fellow practitioners. It is designed to support practitioners of all traditions and experience levels.', 1],
  ['Getting Started', 'Do I need to be an experienced witch to join?', 'Not at all. Spellful welcomes everyone from complete beginners to experienced practitioners. The community is built on the principle that no path is more valid than another and that every witch was a beginner once.', 2],
  ['Getting Started', 'How do I set up my profile?', 'After signing up, visit Account → Profile Studio to add your display name, bio, witch path, pronouns, and profile photo. You can also choose a cover image, avatar frame, and profile theme. Your username can be set once and changed after a 30-day cooldown.', 3],
  ['Getting Started', 'What is Spellful Plus?', 'Spellful Plus is a premium membership that unlocks additional features including custom chat wallpapers, exclusive profile frames, advanced cover presets, and more. Visit the Plus page to see everything included.', 4],
  // Community Features
  ['Community Features', 'What is My Coven?', 'My Coven is your personal community within Spellful. You can invite other members to join your coven, share posts and updates with coven members only, and build a close-knit group of practitioners you trust.', 1],
  ['Community Features', 'What is the Discover feed?', 'Discover shows you posts from across the entire Spellful community, not just people you follow. It is a great way to find new voices, topics, and discussions you might not encounter in your personal feed.', 2],
  ['Community Features', 'What is the difference between Feed, Latest, and Popular?', 'Feed shows posts from people and topics you follow, ordered by relevance. Latest shows all recent posts in chronological order. Popular shows posts with the most engagement over a recent period. You can switch between these views using the filter tabs on the community page.', 3],
  ['Community Features', 'What does Unanswered mean?', 'Unanswered filters the community feed to show only questions and discussions that have not yet received a reply. It is a great way to help newer members or contribute to conversations that need input.', 4],
  ['Community Features', 'What is the Following filter?', 'Following shows posts only from members you follow. It is similar to a personal feed and helps you keep up with practitioners whose content you enjoy.', 5],
  ['Community Features', 'What does Online mean in the community stats?', 'Online shows the number of members who are currently active on Spellful. This count updates regularly. Members who have enabled the Hide Online Status privacy setting will not be counted.', 6],
  ['Community Features', 'What does Registered Members mean?', 'Registered Members shows the total number of accounts that have been created on Spellful. This is the full community size, not just currently active users.', 7],
  ['Community Features', 'What are Saved Posts?', 'Saved Posts (also called Bookmarks) lets you save any community post to read later. Access your saved posts from the Bookmarks section in the community navigation. Saves are private and only visible to you.', 8],
  // Privacy & Safety
  ['Privacy & Safety', 'How do I report a post or member?', 'Every post and member profile has a report option accessible from the three-dot menu. Reports are confidential and reviewed by the moderation team. You can report harassment, hate speech, spam, scams, harmful misinformation, inappropriate content, and privacy violations.', 1],
  ['Privacy & Safety', 'How do I block or mute someone?', 'Visit a member\'s profile and use the three-dot menu to block or mute them. Blocking prevents them from seeing your content or contacting you. Muting hides their posts from your feed without notifying them.', 2],
  ['Privacy & Safety', 'Are my direct messages private?', 'Yes. Direct messages on Spellful use end-to-end encryption. Only you and the person you are messaging can read your conversations. Spellful staff cannot read your messages.', 3],
  ['Privacy & Safety', 'How do I control who can see my profile?', 'Visit Account → My Privacy Sanctuary to control your profile visibility, who can message you, whether you appear in search results, and many other privacy settings.', 4],
  // Technical
  ['Technical', 'Why can I not post yet?', 'New accounts may need to verify their email address before posting. Check your inbox for a verification email from Spellful. If you have verified your email and still cannot post, please use the bug report form.', 1],
  ['Technical', 'How do I delete my account?', 'Visit Account → Security to request account deletion. There is a 30-day grace period during which you can cancel the deletion. After 30 days your account and all associated data will be permanently removed.', 2],
  ['Technical', 'Can I export my data?', 'Yes. Visit Account → Security and use the Export My Data option to download a copy of your Spellful data including your profile, grimoire entries, and activity history.', 3],
];

for (const [category, question, answer, sort_order] of faqRows) {
  await run(`faq: ${question.slice(0, 50)}`, `
    INSERT IGNORE INTO community_faq (category, question, answer, sort_order)
    VALUES (${conn.escape(category)}, ${conn.escape(question)}, ${conn.escape(answer)}, ${sort_order})
  `);
}

// ── Seed: Glossary ────────────────────────────────────────────────────────────
const glossaryRows = [
  // General Witchcraft
  ['Altar', 'altar', 'General Witchcraft', 'A dedicated surface or space used for magical workings, ritual, and devotion. An altar typically holds tools, symbols, and offerings meaningful to the practitioner. Altars may be permanent or temporary and can be arranged according to tradition, personal preference, or the purpose of a working.', 'Altar arrangements vary widely between traditions. Some traditions prescribe specific tool placements; others leave arrangement entirely to the practitioner.', ['ritual', 'tools', 'sacred space']],
  ['Book of Shadows', 'book of shadows', 'General Witchcraft', 'A personal journal or record book in which a witch documents spells, rituals, correspondences, dreams, and magical experiences. Originally associated with Wicca, the term is now used broadly across many traditions. The digital equivalent on Spellful is called the Grimoire.', 'In traditional Wicca, the Book of Shadows was often copied by hand from a teacher. Many modern practitioners use the terms Book of Shadows and Grimoire interchangeably, though some distinguish between them.', ['grimoire', 'journal', 'spellwork']],
  ['Casting a Circle', 'casting a circle', 'General Witchcraft', 'The practice of creating a sacred, protected space for magical work by ritually defining a boundary, often visualised as a sphere of energy. Circles are cast before rituals and closed afterwards. Methods vary by tradition and may involve calling the quarters, invoking deities, or using physical tools such as a wand or athame.', null, ['ritual', 'sacred space', 'quarters']],
  ['Correspondences', 'correspondences', 'General Witchcraft', 'The symbolic associations between objects, colours, numbers, planets, days, herbs, crystals, and other elements used in magical practice. Correspondences help practitioners select appropriate ingredients and timing for spells and rituals. For example, rose quartz corresponds to love, and Friday corresponds to Venus.', 'Correspondence systems vary between traditions and individual practitioners. What works for one witch may differ from another. Personal experience and intuition are valid alongside traditional systems.', ['sympathetic magic', 'herbs', 'crystals']],
  ['Grounding', 'grounding', 'General Witchcraft', 'The practice of connecting one\'s energy to the earth to stabilise, centre, and release excess magical energy after a working. Grounding techniques include visualisation, physical contact with the earth, eating, and breathwork. It is considered an important practice before and after ritual to maintain energetic balance.', null, ['centering', 'energy work', 'ritual']],
  ['Intention', 'intention', 'General Witchcraft', 'The focused purpose or goal behind a magical working. Setting a clear intention is considered fundamental to effective spellwork across most traditions. Intention directs energy toward a specific outcome and distinguishes magical action from mundane action.', null, ['spellwork', 'manifestation', 'focus']],
  ['Manifestation', 'manifestation', 'General Witchcraft', 'The process of bringing a desired outcome into physical reality through focused intention, energy, and action. Manifestation practices vary widely and may include spellwork, visualisation, affirmation, and aligned mundane action. Many practitioners emphasise that magical work should be accompanied by practical steps toward the goal.', null, ['intention', 'spellwork', 'law of attraction']],
  ['Sabbat', 'sabbat', 'General Witchcraft', 'One of eight seasonal festivals observed in Wicca and many modern pagan traditions, marking the turning points of the Wheel of the Year. The eight sabbats are Samhain, Yule, Imbolc, Ostara, Beltane, Litha, Lughnasadh, and Mabon. Each sabbat celebrates a point in the solar cycle and is associated with specific themes, deities, and practices.', 'Sabbat names and practices vary between traditions. Some practitioners observe all eight; others focus on a subset. The specific dates may differ slightly by hemisphere.', ['wheel of the year', 'ritual', 'seasonal magic']],
  ['Sigil', 'sigil', 'General Witchcraft', 'A symbol created and charged with magical intention. Sigils may be drawn, carved, or visualised and are used to represent and focus a specific desire or intention. Methods of creation include combining letters of an intention statement, automatic drawing, and geometric construction.', null, ['intention', 'symbol magic', 'spellwork']],
  // Divination
  ['Cartomancy', 'cartomancy', 'Divination', 'Divination using a deck of cards. While tarot is the most widely known form, cartomancy also includes oracle cards, playing cards, and other card-based systems. Each system uses different imagery and interpretive frameworks.', null, ['tarot', 'oracle cards', 'divination']],
  ['Cleromancy', 'cleromancy', 'Divination', 'Divination by casting or drawing lots, including dice, bones, stones, or runes. The pattern or position of the cast objects is interpreted to gain insight. Rune casting is one of the most widely practised forms of cleromancy in modern witchcraft.', null, ['runes', 'divination', 'casting']],
  ['Oracle Cards', 'oracle cards', 'Divination', 'A card-based divination system that differs from tarot in that it does not follow a fixed structure. Oracle decks are created by individual authors and artists and may use any theme, imagery, or interpretive system. They are often considered more intuitive and accessible than tarot for beginners.', null, ['tarot', 'cartomancy', 'divination']],
  ['Pendulum', 'pendulum', 'Divination', 'A weighted object suspended on a cord or chain used for divination and dowsing. The pendulum is held still and questions are asked; the direction of movement (swing or rotation) is interpreted as yes, no, or uncertain. Pendulums are also used to locate objects, check energy, and communicate with guides.', null, ['dowsing', 'divination', 'energy work']],
  ['Scrying', 'scrying', 'Divination', 'A divination practice involving gazing into a reflective or translucent surface to receive visions or impressions. Common scrying surfaces include mirrors, crystal balls, water, fire, and smoke. Scrying is considered a meditative practice that opens the intuitive mind to symbolic imagery.', null, ['divination', 'mirror magic', 'vision']],
  ['Tarot', 'tarot', 'Divination', 'A card-based divination system consisting of 78 cards divided into the Major Arcana (22 cards representing archetypal themes) and the Minor Arcana (56 cards divided into four suits). Tarot is used for insight, reflection, and guidance rather than prediction. Interpretations draw on symbolism, intuition, and the reader\'s relationship with the cards.', 'Tarot originated in 15th-century Europe as a card game before being adopted for divination. Many different decks and traditions exist. Some practitioners follow traditional Rider-Waite-Smith meanings; others develop entirely personal interpretive systems.', ['cartomancy', 'major arcana', 'minor arcana']],
  // Moon Magic
  ['Dark Moon', 'dark moon', 'Moon Magic', 'The phase immediately before the new moon when the moon is not visible in the sky. The dark moon is associated with rest, introspection, shadow work, banishing, and releasing what no longer serves. Some practitioners distinguish the dark moon from the new moon and use each for different workings.', 'The terms dark moon and new moon are sometimes used interchangeably, though many practitioners distinguish them. The dark moon is the final days of the waning cycle; the new moon is the first visible crescent.', ['new moon', 'moon phases', 'shadow work']],
  ['Full Moon', 'full moon', 'Moon Magic', 'The lunar phase when the moon appears fully illuminated. The full moon is associated with heightened energy, completion, manifestation, charging tools, and releasing what no longer serves. Many practitioners consider the full moon the most powerful time for magical workings.', null, ['moon phases', 'esbat', 'charging']],
  ['Lunar Cycle', 'lunar cycle', 'Moon Magic', 'The approximately 29.5-day cycle of the moon through its phases: new moon, waxing crescent, first quarter, waxing gibbous, full moon, waning gibbous, last quarter, and waning crescent. Each phase is associated with different magical energies and intentions. Tracking the lunar cycle is a foundational practice in many witchcraft traditions.', null, ['moon phases', 'new moon', 'full moon']],
  ['New Moon', 'new moon', 'Moon Magic', 'The lunar phase when the moon is not visible or appears as a thin crescent. The new moon is associated with new beginnings, setting intentions, planting seeds, and initiating new projects. It is considered an auspicious time for spells related to growth, attraction, and fresh starts.', null, ['lunar cycle', 'moon phases', 'intention']],
  ['Waning Moon', 'waning moon', 'Moon Magic', 'The phase of the lunar cycle after the full moon as the visible illumination decreases toward the new moon. The waning moon is associated with releasing, banishing, letting go, breaking habits, and clearing away what no longer serves. Workings for decrease, removal, and endings are traditionally performed during this phase.', null, ['lunar cycle', 'banishing', 'releasing']],
  ['Waxing Moon', 'waxing moon', 'Moon Magic', 'The phase of the lunar cycle from the new moon to the full moon as the visible illumination increases. The waxing moon is associated with growth, attraction, building, and drawing things toward you. Spells for increase, abundance, and new beginnings are traditionally performed during this phase.', null, ['lunar cycle', 'attraction', 'growth']],
  // Herbs
  ['Cleansing', 'cleansing', 'Herbs & Plants', 'The practice of removing negative, stagnant, or unwanted energy from a person, object, or space. Cleansing methods include smoke cleansing with herbs, sound, salt, water, and visualisation. Cleansing is often performed before ritual, when moving into a new space, or when energy feels heavy or stagnant.', 'The term smudging specifically refers to Indigenous North American ceremonial practices and is considered a closed practice by many Indigenous communities. Practitioners outside those traditions are encouraged to use the term smoke cleansing and to work with herbs from their own cultural heritage or that are not considered sacred to closed traditions.', ['smoke cleansing', 'purification', 'energy work']],
  ['Correspondences (Herbal)', 'correspondences herbal', 'Herbs & Plants', 'The magical associations attributed to specific herbs and plants, including their elemental alignment, planetary rulership, and the intentions they support. For example, lavender is associated with peace and sleep; rosemary with protection and memory; mugwort with dreams and psychic ability. Herbal correspondences vary between traditions and sources.', null, ['correspondences', 'herbs', 'spellwork']],
  ['Green Witchcraft', 'green witchcraft', 'Herbs & Plants', 'A nature-based practice centred on working with plants, herbs, the earth, and the natural world. Green witches typically develop deep knowledge of plant properties, herbal medicine, and the magical uses of botanicals. The practice emphasises a close relationship with the land and seasonal cycles.', null, ['hedge witchcraft', 'herbalism', 'nature magic']],
  ['Smoke Cleansing', 'smoke cleansing', 'Herbs & Plants', 'The practice of burning herbs, resins, or wood to produce smoke used to cleanse a person, object, or space of negative or stagnant energy. Common herbs used include rosemary, lavender, cedar, and mugwort. Smoke cleansing is distinct from smudging, which refers specifically to Indigenous ceremonial practices.', 'Practitioners are encouraged to use herbs from their own cultural heritage or that are widely cultivated rather than wildcrafted sacred plants. White sage, for example, is considered sacred by many Indigenous communities and is also at risk from overharvesting.', ['cleansing', 'herbs', 'purification']],
  // Crystals
  ['Charging', 'charging', 'Crystals', 'The practice of infusing a crystal, tool, or object with energy or intention. Common charging methods include placing objects in moonlight or sunlight, burying in earth, using sound, breath, or visualisation. Charging is often performed after cleansing to programme an object for a specific purpose.', null, ['crystals', 'cleansing', 'intention']],
  ['Crystal Grid', 'crystal grid', 'Crystals', 'An arrangement of crystals in a geometric pattern used to amplify and direct energy toward a specific intention. Grids typically include a central stone, surrounding stones, and may be placed on a sacred geometry template. The arrangement is activated by connecting the stones with intention or a wand.', null, ['crystals', 'sacred geometry', 'intention']],
  ['Programming', 'programming', 'Crystals', 'The practice of setting a specific intention into a crystal so that it works toward that purpose. Programming is typically done after cleansing and charging by holding the crystal, focusing on the intention, and directing that energy into the stone through breath, visualisation, or spoken words.', null, ['crystals', 'intention', 'charging']],
  // Spellwork
  ['Banishing', 'banishing', 'Spellwork', 'Magical work intended to remove, repel, or send away unwanted energies, influences, habits, or entities. Banishing spells are typically performed during the waning moon. Common banishing methods include burning written intentions, black candle magic, and cord cutting.', null, ['cord cutting', 'waning moon', 'protection']],
  ['Candle Magic', 'candle magic', 'Spellwork', 'A form of spellwork using candles as the primary magical tool. Candle colour, carving, anointing with oils, and burning time are all used to focus and direct intention. Candle magic is considered one of the most accessible and widely practised forms of spellwork.', null, ['spellwork', 'correspondences', 'intention']],
  ['Cord Cutting', 'cord cutting', 'Spellwork', 'A ritual or visualisation practice used to sever energetic ties to a person, situation, habit, or emotion that no longer serves. Cord cutting may involve physically cutting a cord or ribbon while visualising the energetic connection dissolving. It is often used to support healing after relationships end or to release unhealthy attachments.', null, ['banishing', 'releasing', 'healing magic']],
  ['Protection Magic', 'protection magic', 'Spellwork', 'Magical workings intended to shield, ward, or protect a person, space, or object from harm, negative energy, or unwanted influences. Protection methods include wards, shields, protective sachets, amulets, and boundary-setting rituals. Protection magic is one of the most widely practised forms of spellwork across traditions.', null, ['warding', 'amulet', 'banishing']],
  ['Sympathetic Magic', 'sympathetic magic', 'Spellwork', 'A magical principle based on the idea that like affects like and that things once connected remain connected. Sympathetic magic uses representations, symbols, and correspondences to influence the target of a working. Poppets, photographs, and personal items are common tools in sympathetic magic.', null, ['correspondences', 'spellwork', 'poppet']],
  // Energy Work
  ['Aura', 'aura', 'Energy Work', 'The energetic field surrounding a living being, often described as layers of light or colour that reflect physical, emotional, mental, and spiritual states. Aura reading is a form of psychic perception used to assess a person\'s energy. Aura cleansing practices aim to clear and strengthen this field.', null, ['energy work', 'chakras', 'psychic ability']],
  ['Chakras', 'chakras', 'Energy Work', 'Energy centres within the body described in Hindu and yogic traditions, each associated with specific physical, emotional, and spiritual qualities. The seven main chakras run along the spine from the base to the crown. Chakra work aims to balance and align these centres to support wellbeing. This system originates in South Asian spiritual traditions.', 'Chakra systems originate in Hindu and yogic traditions. Practitioners outside these traditions are encouraged to engage with this knowledge respectfully and with awareness of its cultural origins.', ['energy work', 'aura', 'healing']],
  ['Shadow Work', 'shadow work', 'Energy Work', 'A psychological and spiritual practice of exploring and integrating the unconscious or repressed aspects of the self, often called the shadow. Shadow work draws on Jungian psychology and is used in many witchcraft traditions to promote self-awareness, healing, and personal growth. It may involve journalling, tarot, meditation, and ritual.', null, ['inner work', 'healing', 'psychology']],
];

for (const [term, term_normalized, category, definition, tradition_notes, related_terms] of glossaryRows) {
  await run(`glossary: ${term}`, `
    INSERT IGNORE INTO community_glossary (term, term_normalized, category, definition, tradition_notes, related_terms)
    VALUES (
      ${conn.escape(term)},
      ${conn.escape(term_normalized)},
      ${conn.escape(category)},
      ${conn.escape(definition)},
      ${tradition_notes ? conn.escape(tradition_notes) : 'NULL'},
      ${conn.escape(JSON.stringify(related_terms))}
    )
  `);
}

await conn.end();
console.log('\n✅ Help & Resources migration complete.');
