import type { DevelopmentContent, DevelopmentEntry } from './types';

/*
 * English development calendar — the same stages and statements as `de.ts`,
 * written for English readers rather than translated word for word. Sources
 * lean on English-language institutions (CDC/AAP, NHS, WHO); the German
 * check-up and vaccination schedule is kept but explicitly labelled as such,
 * since the app's checklist of preventive check-ups (U1–U9) is German.
 */

const weeks: readonly DevelopmentEntry[] = [
  // Week 1
  {
    title: 'Welcome to the world',
    teaser:
      'Your baby arrives with built-in reflexes: a firm grip, rooting for the breast and strong sucking.',
    body: [
      'In the first days, behaviour is driven mostly by inborn reflexes. Put a finger in your baby’s palm and they grip it tightly (grasp reflex). Touch their cheek and they turn and search (rooting reflex). A sudden noise makes them fling their arms out (Moro reflex). These reflexes fade over the coming months as purposeful movements take over.',
      'Right now your baby sees most clearly at about 20 to 30 centimetres — roughly the distance to your face during a feed. Your voices, smell and skin are already familiar from the womb.',
      'In Germany, the U2 check-up takes place between day 3 and day 10, and newborn screening (a small blood test) and a hearing screen are offered in the first days. Depending on the birth month, the German vaccination committee (STIKO) also recommends a single dose of RSV protection — ask your paediatrician.',
    ],
    tips: [
      'Plenty of skin-to-skin contact calms your baby and helps them settle into the new world.',
      'Sort out your paediatric practice early and book the next check-up.',
      'Keep your child’s health record booklet safe — you will need it for years.',
    ],
    sources: ['cdc2Months', 'kgiCheckups', 'rkiVaccinationSchedule'],
  },
  // Week 2
  {
    title: 'Safe sleep from the start',
    teaser:
      'Newborns sleep a lot, but in short stretches spread across day and night. A safe sleeping place matters most right now.',
    body: [
      'There is no day–night rhythm yet: your baby sleeps many hours in total but wakes every few hours because they are hungry. That is normal and healthy.',
      'To reduce the risk of sudden infant death, experts recommend: sleeping on the back, in their own cot in the parents’ bedroom, in a baby sleeping bag instead of under blankets, with no pillows, bumpers or soft toys in the cot, in a smoke-free home and not too warm (a room temperature of about 16 to 18 °C).',
      'In Germany, paediatricians usually recommend vitamin D (often combined with fluoride) from about the second week of life to prevent rickets. Ask your practice how and for how long.',
    ],
    tips: [
      'Back to sleep, sleeping bag, own cot in your bedroom — and nothing else in the cot.',
      'Sleep when your baby sleeps: the first weeks are hard on parents too.',
    ],
    sources: ['kgiBabySleep', 'nhsCryingBaby'],
  },
  // Week 3
  {
    title: 'Why babies cry',
    teaser:
      'Many babies cry more in these weeks than before. It is part of normal development — and exhausting all the same.',
    body: [
      'Crying is your baby’s main way of communicating: hunger, tiredness, a full nappy, discomfort or simply the need to be close. In almost all babies, crying increases from about two weeks of age and peaks around six weeks. After that it usually eases off gradually.',
      'Not every bout of crying can be stopped. What matters is that your baby feels someone is there. Calm, body contact, dim light and steady sounds or movements often help.',
      'If it all gets too much: put your baby down safely in their cot, leave the room for a moment and breathe. Never shake a baby — it can cause life-threatening brain injuries.',
    ],
    tips: [
      'Check the basics: hungry, nappy, too warm or too cold, tired?',
      'Try carrying, gentle rocking, quiet humming or steady white noise.',
      'Accept help: midwives, your paediatrician and local family support services are there for you.',
    ],
    sources: ['nhsCryingBaby', 'kgiCrying'],
  },
  // Week 4
  {
    title: 'Tummy time while awake',
    teaser:
      'On their tummy, your baby already tries to lift their head briefly. Short practice sessions while awake strengthen neck and shoulders.',
    body: [
      'Your baby should sleep on their back. But when they are awake and you are with them, tummy time is valuable practice: your baby tries to lift and turn their head, strengthening the muscles of the neck, shoulders and back.',
      'At first a minute on your chest or across your lap is enough. Many babies find tummy time hard work at first — it gets easier. Varying positions also helps prevent a flattened area on the back of the head.',
    ],
    tips: [
      'Put your baby on their tummy briefly several times a day — only when awake and supervised.',
      'Get down to eye level: your face is the most interesting “toy” there is.',
    ],
    sources: ['nhsBabyMoves', 'cdc2Months'],
  },
  // Week 5
  {
    title: 'Time for a check-up',
    teaser:
      'In Germany, the U3 check-up falls between weeks 4 and 5 — including an ultrasound scan of the hips.',
    body: [
      'At this check-up the paediatrician looks at how well your baby feeds and gains weight, how they move and how they respond. In Germany, a hip ultrasound is part of the U3 to detect hip development problems early. Other countries schedule their routine checks differently.',
      'A check-up is also a good moment for your own questions: about sleep, crying, digestion, vitamin D or the upcoming vaccinations.',
    ],
    tips: [
      'Bring your child’s health record booklet and insurance card.',
      'Write your questions down beforehand — it is easy to forget things during the appointment.',
    ],
    sources: ['kgiCheckups', 'cdc2Months'],
  },
  // Week 6
  {
    title: 'The first smile',
    teaser: 'Around now many babies show their first “social” smile — a smile meant for you.',
    body: [
      'Even newborns sometimes curl their lips in their sleep. But from around six to eight weeks, many babies smile on purpose when they see a familiar face or hear a voice. This social smile is an important step: your baby is starting to connect with you.',
      'Some babies smile earlier, others a little later. When you smile back and talk to them, your baby learns that their expressions make something happen.',
    ],
    tips: [
      'Talk to your baby face to face — with pauses in which they can “answer”.',
      'The first smile makes a lovely milestone to record with a photo.',
    ],
    sources: ['cdc2Months', 'kgiDevelopmentTasks'],
  },
  // Week 7
  {
    title: 'When crying peaks',
    teaser:
      'For many babies, crying peaks between weeks 6 and 8. After that it usually decreases little by little.',
    body: [
      'Many babies cry a lot now, especially in the late afternoon and evening, often for no obvious reason. This is usually not tummy pain but a sign that the baby is still learning to process stimulation and settle. Overtiredness and too many impressions often make crying worse.',
      'If your baby cries a great deal over several weeks (more than three hours a day on more than three days a week), or you feel you can no longer soothe them, talk to your paediatrician. Many areas have specialist services that support families with excessive crying.',
    ],
    tips: [
      'Reduce stimulation: a darkened room, few visitors, predictable routines.',
      'Take turns — and let someone you trust look after the baby for an hour.',
      'Never shake. If nothing works: put the baby down safely and take a breather.',
    ],
    sources: ['nhsCryingBaby', 'kgiCryingProblems'],
  },
  // Week 8
  {
    title: 'First sounds and conversations',
    teaser:
      'Besides crying you now hear soft sounds like “aah” or “ghh” more often — your baby is starting to “chat”.',
    body: [
      'From about two months, many babies discover their voice: they coo, gurgle and make vowel-like sounds. When you pick up these sounds and answer, a first little back-and-forth conversation begins — the foundation of later language development.',
      'Around eight weeks, routine vaccinations begin in many countries, including Germany (the oral rotavirus vaccine can start from six weeks). Your paediatrician will explain which vaccines are due and when.',
    ],
    tips: [
      'Copy your baby’s sounds and leave pauses — that is how they learn to take turns.',
      'Narrate everyday life: “Now we’re putting your sock on.” The content doesn’t matter, the attention does.',
    ],
    sources: ['cdc2Months', 'rkiVaccinationSchedule'],
  },
  // Week 9
  {
    title: 'Discovering hands',
    teaser:
      'The little fists open more often. Your baby looks at their hands and brings them to their mouth.',
    body: [
      'In the first weeks, hands are mostly clenched into fists. Now they open more and more, and many babies start looking at their hands, bringing them together and sucking on them. This is not a hunger cue but self-discovery — and a way to self-soothe.',
      'Linking what they see with how they move is an early step towards deliberate grasping.',
    ],
    tips: [
      'Place a small, light rattle in your baby’s hand — they can already hold it briefly.',
      'Leave hands uncovered when it isn’t cold, so your baby can explore them.',
    ],
    sources: ['cdc2Months', 'cdc4Months'],
  },
  // Week 10
  {
    title: 'Following with the eyes',
    teaser:
      'Your baby follows faces and objects with their eyes more and more reliably and looks at them for longer.',
    body: [
      'Vision develops rapidly in the first months. Many babies can now follow a slowly moving face or toy with their eyes and look at things for longer and with more focus. Strong contrasts and faces are particularly interesting.',
      'In Germany the U4 check-up is due in the coming weeks (in the third to fourth month). It covers movement, hearing and vision, and usually vaccinations too.',
    ],
    tips: [
      'Move a toy slowly from one side to the other and see whether your baby follows it.',
      'Book the next check-up in good time.',
    ],
    sources: ['cdc2Months', 'kgiCheckups'],
  },
  // Week 11
  {
    title: 'A steadier head',
    teaser:
      'The neck muscles get stronger: on their tummy, your baby increasingly props up on their forearms and lifts their head.',
    body: [
      'When you pick your baby up, their head still needs support, but it wobbles less. On their tummy, your baby lifts their head higher and for longer and starts to push up on their forearms. By four months, most babies can hold their head steady without support when held.',
      'How quickly this happens varies. Regular short spells of tummy time while awake help.',
    ],
    tips: [
      'Play on the floor: a firm blanket, a mirror or a colourful cloth in front of their face.',
      'Keep supporting the head loosely when carrying your baby.',
    ],
    sources: ['nhsBabyMoves', 'cdc4Months'],
  },
  // Week 12
  {
    title: 'A rhythm emerges',
    teaser:
      'Many babies gradually find a day–night rhythm now and sleep in longer stretches at night.',
    body: [
      'Around three months, most babies develop their own day–night rhythm. Night-time sleep stretches often get a little longer, with several naps during the day. Sleeping through the night in the adult sense is still a long way off — waking at night is normal throughout the first year.',
      'You can support the rhythm: light, noise and activity during the day; dim light, little talking and short, quiet feeds at night.',
    ],
    tips: [
      'Introduce a recurring routine before sleep, e.g. nappy change, sleeping bag, song.',
      'Watch for tired signs — yawning, eye rubbing, staring — and head for bed.',
    ],
    sources: ['kgiBabySleep', 'kgiDevelopmentTasks'],
  },
  // Week 13
  {
    title: 'Three months done',
    teaser:
      'Three months! For many babies crying decreases now, and they are more alert and curious than before.',
    body: [
      'Many parents experience the end of the third month as a turning point: the baby cries less, stays contentedly awake for longer and actively seeks contact — with looks, smiles and sounds. They have learned an enormous amount in a short time.',
      'If heavy crying continues beyond three months, it is worth talking to your paediatrician or a family support service.',
    ],
    tips: [
      'Take a moment to look back: what has changed since birth? A photo a month is a lovely tradition.',
      'Parents need recovery time too — plan some in.',
    ],
    sources: ['nhsCryingBaby', 'cdc4Months'],
  },
  // Week 14
  {
    title: 'Recognising voices',
    teaser:
      'When your baby hears a familiar voice, they turn their head towards it and look for you.',
    body: [
      'Hearing is already well developed at birth. Now your baby gets better at locating sounds: they turn their head towards a voice or a noise and recognise familiar voices. Music, singing and talking are great fun for them.',
      'If your baby barely reacts to sounds or voices, mention it at the next check-up — even if the newborn hearing screen was normal.',
    ],
    tips: [
      'Speak to your baby from the side and watch whether they turn their head.',
      'Songs and finger rhymes with melody and rhythm are ideal.',
    ],
    sources: ['cdc4Months', 'kgiFirstYear'],
  },
  // Week 15
  {
    title: 'Swiping at things',
    teaser:
      'Your baby swipes at toys hanging above them and holds a rattle when you put it in their hand.',
    body: [
      'Grasping develops in stages: first your baby swings their arms at interesting things, then they hit their target more and more often, and somewhere between three and six months they reach out and grab on purpose. Many babies are in the middle of this process now.',
      'A play gym or a toy held within reach invites them to try — and every “hit” is a small success.',
    ],
    tips: [
      'Offer toys within reach, sometimes on the left, sometimes on the right.',
      'Choose light, easy-to-hold things: fabric rings, teething rings, small rattles.',
    ],
    sources: ['cdc4Months', 'nhsBabyMoves'],
  },
  // Week 16
  {
    title: 'Chuckles and laughter',
    teaser:
      'Around now many babies chuckle and laugh out loud for the first time — during tickling games, for example.',
    body: [
      'At about four months, many babies start to laugh or chuckle audibly when you play with them. They smile on their own to get your attention and react clearly to your facial expressions and voice.',
      'Laughter is a shared experience: your baby learns that joy can be shared.',
    ],
    tips: [
      'Try gentle tickling, blowing and peekaboo games.',
      'If your baby looks away, they need a break — that’s fine.',
    ],
    sources: ['cdc4Months', 'kgiDevelopmentTasks'],
  },
  // Week 17
  {
    title: 'Everything goes in the mouth',
    teaser:
      'The mouth is now the most important exploration tool: whatever your baby can grab gets a thorough “inspection”.',
    body: [
      'Lips and tongue are very sensitive, so babies explore objects with their mouth first. This is a normal and important part of development — and the reason to watch out for small parts from now on.',
      'Drooling a lot is common at this age and doesn’t necessarily mean a tooth is on its way.',
    ],
    tips: [
      'Anything that fits through a toilet roll tube is too small for a baby and belongs out of reach.',
      'Choose toys without detachable small parts and wash them regularly.',
    ],
    sources: ['cdc4Months', 'cdc6Months'],
  },
  // Week 18
  {
    title: 'From tummy to back',
    teaser:
      'Some babies roll from their tummy onto their back for the first time now — often quite unexpectedly.',
    body: [
      'Between four and seven months, most babies learn to roll — often from tummy to back first, later the other way round too. On their tummy, many already push up on their hands and lift their chest.',
      'Because rolling usually happens suddenly, never leave your baby alone on a changing table or sofa, not even for a moment.',
    ],
    tips: [
      'Give your baby plenty of floor space to practise.',
      'Always keep a hand on your baby when they are on a raised surface.',
    ],
    sources: ['nhsBabyMoves', 'cdc6Months'],
  },
  // Week 19
  {
    title: 'Ready for solids?',
    teaser:
      'German guidance allows solid food from the start of the fifth month. Your baby will show you when they are ready.',
    body: [
      'Recommendations differ slightly between countries: German experts advise starting solids no earlier than the beginning of the fifth month and no later than the beginning of the seventh, while the WHO and NHS recommend around six months. So there is no need to start exactly now — the window is deliberately wide.',
      'Signs of readiness include: your baby can sit upright with a little support and hold their head steady, shows interest in what others are eating and opens their mouth when offered a spoon. Breast or bottle feeding continues alongside.',
    ],
    tips: [
      'Start with a simple vegetable purée and offer small amounts.',
      'No honey in the first year.',
    ],
    sources: ['gesundInsLeben', 'cdc6Months'],
  },
  // Week 20
  {
    title: 'Squeals, raspberries and babble',
    teaser:
      'Your baby is trying out their voice: they squeal, blow raspberries, hum and “reply” to your sounds.',
    body: [
      'Many babies now experiment enthusiastically with sounds: high and low tones, raspberries, loud squeals. They notice that their voice has an effect and take turns with you in “conversation”.',
      'For language development, talking with your baby matters far more than playing them recordings. Real conversation beats any audio.',
    ],
    tips: [
      'Copy raspberries and humming sounds, then wait to see whether your baby answers.',
      'Sing during nappy changes and bath time — repetition makes songs familiar.',
    ],
    sources: ['cdc6Months', 'cdc4Months'],
  },
  // Week 21
  {
    title: 'Both hands at work',
    teaser:
      'Your baby grasps more and more deliberately, picks things up with both hands and starts passing them from one hand to the other.',
    body: [
      'Grasping becomes more precise: your baby reaches for toys, grabs them with the whole hand and examines them from all sides. Soon they will start moving things from one hand to the other — a skill most children have by nine months.',
      'Many families also start solid food in these weeks. The first spoonful is a lovely milestone — however much of it actually ends up in the mouth.',
    ],
    tips: [
      'Offer two toys one after the other and watch how your baby handles them.',
      'Offer solids calmly and without pressure — refusing is part of it.',
    ],
    sources: ['cdc6Months', 'cdc9Months'],
  },
  // Week 22
  {
    title: 'Familiar faces',
    teaser:
      'Your baby tells familiar people and strangers apart more and more clearly, and loves looking in the mirror.',
    body: [
      'By about six months, most babies reliably recognise their caregivers and are visibly happy to see them. Some are already more reserved with strangers. Many are fascinated by their reflection — even though they don’t recognise themselves in it yet.',
      'Steady caregivers provide security. Besides parents, that includes other people who are around regularly.',
    ],
    tips: [
      'Mirror games: pull faces together and name what you see.',
      'Look at photo books with family faces.',
    ],
    sources: ['cdc6Months', 'kgiDevelopmentTasks'],
  },
  // Week 23
  {
    title: 'Strong on their tummy',
    teaser:
      'On their tummy your baby now often pushes up on straight arms and pivots around in a circle.',
    body: [
      'Many babies push themselves up on straight arms, lift their chest well off the floor and look around. Some spin in circles or shuffle backwards — first attempts at getting around.',
      'Free movement on the floor is the best training for this — no special equipment needed.',
    ],
    tips: [
      'Place a toy just out of reach — an incentive to stretch.',
      'Use bouncers and car seats only briefly; the floor is the best playground.',
    ],
    sources: ['nhsBabyMoves', 'cdc6Months'],
  },
  // Week 24
  {
    title: 'Sitting with support',
    teaser:
      'With support your baby sits more and more steadily. Children learn to sit alone somewhere between about 4 and 9 months.',
    body: [
      'Many babies now like to sit on your lap and hold themselves fairly upright. Some lean forward on their hands when sat down. According to the WHO Motor Development Study, almost all healthy children learn to sit without support somewhere between about 4 and 9 months — a wide range.',
      'Your baby doesn’t need training for this: they learn to sit best by rolling, pushing up and moving on the floor. There is no need to prop them up for long before they can do it themselves.',
    ],
    tips: [
      'Look at a book together on your lap — it practises posture along the way.',
      'Plenty of free floor time instead of long spells in a seat or high chair.',
    ],
    sources: ['whoMotorMilestones', 'cdc6Months'],
  },
  // Week 25
  {
    title: 'The first tooth?',
    teaser:
      'Many babies get their first tooth around six months — some much earlier, others not until after their first birthday.',
    body: [
      'Usually the lower front teeth come first. Many babies then drool more, chew on everything and are a bit more unsettled. High fever or diarrhoea, on the other hand, are not typical teething signs and should be checked by a doctor.',
      'Brushing starts with the first tooth: twice a day with a rice-grain-sized smear of fluoride toothpaste. In Germany, dental check-ups for young children are covered from six months of age.',
    ],
    tips: [
      'Chilled (not frozen) teething rings can help.',
      'Introduce brushing playfully: let your baby explore the brush first, then brush for them.',
    ],
    sources: ['kgiFirstYear', 'cdc6Months'],
  },
  // Week 26
  {
    title: 'Half a year',
    teaser:
      'Six months! In Germany that means the U5 check-up — and a chance to look at everything your baby can already do.',
    body: [
      'In Germany the U5 takes place between the sixth and seventh month. It covers movement, vision, hearing, nutrition and vaccinations, among other things. By the start of the seventh month, solid food should have been introduced too.',
      'In the first half year your baby has learned to make contact, laugh, grasp, roll and use their voice. How quickly each skill arrives is very individual — what matters is that your child keeps developing overall.',
    ],
    tips: [
      'Book the check-up and bring the health record booklet.',
      'Look around your home for hazards — your baby will soon be on the move.',
    ],
    sources: ['cdc6Months', 'kgiCheckups', 'gesundInsLeben'],
  },
  // Week 27
  {
    title: 'Ba-ba-ba: babbling',
    teaser:
      'Many babies now start stringing syllables together: “ba-ba-ba”, “da-da-da” or “ma-ma-ma”.',
    body: [
      'This so-called canonical babbling usually begins between six and ten months. The syllables don’t mean anything yet — however tempting “ma-ma” or “da-da” sound. Still, babbling is a huge step: your baby is practising the sounds of their language.',
      'Babies growing up with more than one language babble just the same — multilingualism is no disadvantage for language development.',
    ],
    tips: [
      'Pick up the syllables and vary them: “ba-ba — yes, ball!”',
      'Look at picture books with simple, large pictures and name what you see.',
    ],
    sources: ['cdc9Months', 'cdc6Months'],
  },
  // Week 28
  {
    title: 'Peekaboo — there you are!',
    teaser:
      'Your baby is beginning to understand that things and people still exist even when they can’t see them.',
    body: [
      'When a toy falls down, your baby now looks after it or searches for it. Experts call this object permanence. That is why hiding games like peekaboo become so funny now — and why some babies find saying goodbye harder, because they notice when someone is gone.',
      'Many babies now also drop things on purpose to see what happens. That is scientific curiosity, not mischief.',
    ],
    tips: [
      'Hide a toy under a cloth and find it again together.',
      'Play peekaboo with your hands or a cloth over your face.',
    ],
    sources: ['cdc9Months', 'kgiDevelopmentTasks'],
  },
  // Week 29
  {
    title: 'Getting on the move',
    teaser:
      'Rolling, commando crawling, spinning in circles: many babies are finding their very own way to get from A to B.',
    body: [
      'Before babies crawl, many try other ways of getting around: they roll across the room, pull themselves forward on their tummy with their arms or push themselves backwards. Some children skip crawling altogether and later bottom-shuffle — that is normal too.',
      'Now at the latest is the time to childproof your home: sockets, cables, stairs, cleaning products, medicines and wobbly furniture.',
    ],
    tips: [
      'Crawl through your home at baby height once — it’s the best way to spot hazards.',
      'Fit stair gates at the top and bottom of stairs.',
    ],
    sources: ['nhsBabyMoves', 'whoMotorMilestones'],
  },
  // Week 30
  {
    title: 'Sitting alone',
    teaser: 'Many babies now sit for a while without support, with their hands free to play.',
    body: [
      'Sitting freely opens up a new perspective: your baby has both hands free, can look around and handle things. By nine months most children sit steadily without support, and many get into a sitting position by themselves.',
      'If your baby can’t sit alone yet, that is no cause for concern at this age. The WHO data show a range up to about nine months.',
    ],
    tips: [
      'At first, put cushions around in case they topple over.',
      'Offer things to unpack: a box with spoons, cups and cloths.',
    ],
    sources: ['whoMotorMilestones', 'cdc9Months'],
  },
  // Week 31
  {
    title: 'Joining in at the table',
    teaser:
      'Your baby is very interested in what everyone else is eating and wants to help themselves.',
    body: [
      'Alongside purées you can offer soft pieces that are easy to hold, such as steamed vegetables or soft fruit. Many babies love feeding themselves with their fingers and learn to chew and move pieces around their mouth. With your help they can take first sips of water from an open cup.',
      'Gagging is part of learning to eat and is a protective reflex. Small, hard foods such as whole nuts or raw carrot pieces are off-limits because of the choking risk.',
    ],
    tips: [
      'Always let your baby eat sitting upright and supervised.',
      'Eat together: your baby learns a lot by watching.',
    ],
    sources: ['cdc9Months', 'gesundInsLeben'],
  },
  // Week 32
  {
    title: 'Stranger anxiety',
    teaser:
      'Suddenly your baby cries around people they actually know? Stranger anxiety is typical at this age — and a good sign.',
    body: [
      'Many babies become shy, clingy or fearful around strangers between six and nine months. It shows that your baby can now clearly tell familiar people from unfamiliar ones and has formed a close bond with their caregivers.',
      'How strongly children react varies a lot. Pressure doesn’t help — time and a secure base do.',
    ],
    tips: [
      'Let your baby get to know visitors from a safe distance (in your arms).',
      'Ask relatives to approach slowly rather than taking the baby straight away.',
    ],
    sources: ['cdc9Months', 'kgiDevelopmentTasks'],
  },
  // Week 33
  {
    title: 'Practising goodbyes',
    teaser:
      'Your baby notices when you leave and protests. Short, reliable goodbyes help them build trust.',
    body: [
      'Because your baby now understands that you still exist when they can’t see you, being apart is often hard for them. Separation anxiety is normal at this age and a sign of secure attachment.',
      'Slipping away secretly tends to unsettle them more. A short, loving goodbye ritual is better — and then actually leaving. The experience that “Mum or Dad comes back” is the best protection against separation anxiety.',
    ],
    tips: [
      'Always say when you are leaving — even if it is only to the kitchen.',
      'A familiar comforter can help with transitions (in the cot only from the first birthday).',
    ],
    sources: ['cdc9Months', 'kgiDevelopmentTasks'],
  },
  // Week 34
  {
    title: 'Crawling',
    teaser:
      'Off on hands and knees: many babies crawl now — others commando crawl, shuffle or skip crawling altogether.',
    body: [
      'According to the WHO study, most children learn to crawl on hands and knees between about 5 and 13.5 months. A small share of children never crawl and find other routes to walking. What matters is that your baby gets around better and better overall.',
      'With crawling their range grows — and with it their curiosity about drawers, cupboards and everything on the floor.',
    ],
    tips: [
      'Build an obstacle course from cushions and blankets.',
      'Fill low drawers with safe things and move dangerous items up high.',
    ],
    sources: ['whoMotorMilestones', 'nhsBabyMoves'],
  },
  // Week 35
  {
    title: 'Sleep in flux',
    teaser:
      'Many babies start waking more at night again, even though things were going better. New skills and separation anxiety can be behind it.',
    body: [
      'Around eight to ten months many parents report more restless nights. Babies sometimes practise their new skills in their sleep, wake up and want to make sure someone is there. Such phases are usually temporary.',
      'A predictable evening with fixed rituals and a similar bedtime give orientation. Most babies still nap twice a day at this age.',
    ],
    tips: [
      'Keep the evening routine short and the same: e.g. dinner, wash, sleeping bag, song.',
      'Respond to night waking calmly and without fuss.',
    ],
    sources: ['kgiSleepProblems', 'kgiBabySleep'],
  },
  // Week 36
  {
    title: 'Pulling up to stand',
    teaser: 'Your baby pulls up on furniture or your legs and stands — still holding on tight.',
    body: [
      'Many babies now pull themselves up on anything that offers support: the sofa, cot bars, the coffee table. At first they often don’t know how to get back down — and call for help. By their first birthday, most children pull up to stand.',
      'Wobbly furniture and shelves should now be fixed to the wall; tablecloths are an underestimated hazard.',
    ],
    tips: [
      'Practise sitting down: gently guide your baby’s knees as they lower themselves.',
      'Secure shelves and chests of drawers to the wall.',
    ],
    sources: ['whoMotorMilestones', 'cdc1Year'],
  },
  // Week 37
  {
    title: 'The pincer grasp',
    teaser:
      'Tiny crumbs now get picked up between thumb and index finger — the fine pincer grasp is developing.',
    body: [
      'Until now your baby has grabbed with their whole hand or raked with their fingers. Now movements become finer: thumb and index finger work together. By their first birthday, most children can pick up small things this way.',
      'That makes finger food especially exciting — and small parts on the floor especially dangerous.',
    ],
    tips: [
      'Offer soft peas, oat flakes or small pieces of banana for practice.',
      'Check the floor regularly for coins, button batteries and small parts.',
    ],
    sources: ['cdc1Year', 'cdc9Months'],
  },
  // Week 38
  {
    title: 'Gestures say a lot',
    teaser: 'Arms up means “Pick me up!”: your baby uses more and more gestures to communicate.',
    body: [
      'Long before the first words, babies communicate with their bodies: they hold up their arms to be picked up, push away things they don’t want and start pointing at things. Gestures are an important forerunner of language.',
      'When you put the gesture into words (“You want up? Come here!”), you help your baby link gestures and words.',
    ],
    tips: [
      'Respond to gestures and add words to them.',
      'Model simple gestures: waving, nodding, shaking your head.',
    ],
    sources: ['cdc9Months', 'cdc1Year'],
  },
  // Week 39
  {
    title: 'Knowing their name',
    teaser:
      'Your baby looks up when you say their name and understands more and more of what you say.',
    body: [
      'Understanding runs far ahead of speaking. Most babies respond to their name around nine months, understand familiar words like “bottle” or “Daddy” and soon also a “no” — even if they don’t obey it yet.',
      'Lots of talk in everyday life, naming things and picture books are the best fuel for language development now.',
    ],
    tips: [
      'Name objects while your baby is looking at them.',
      'Use short, clear sentences and repeat a lot.',
    ],
    sources: ['cdc9Months', 'cdc1Year'],
  },
  // Week 40
  {
    title: 'Cruising along the furniture',
    teaser: 'Sideways along the sofa: many babies now take their first steps while holding on.',
    body: [
      'Walking while holding on (“cruising”) is the last stage before walking freely for many children. According to WHO data, children start doing this somewhere between about 6 and 14 months. Your baby is practising balance, shifting weight and courage.',
      'Barefoot or in non-slip socks your baby feels the floor best. Baby walkers on wheels are not recommended because of the risk of accidents.',
    ],
    tips: [
      'Arrange furniture so your baby can work their way from one piece to the next.',
      'Barefoot indoors — shoes are only needed outside.',
    ],
    sources: ['whoMotorMilestones', 'cdc1Year'],
  },
  // Week 41
  {
    title: 'Waving and clapping',
    teaser: 'Your baby copies what they see: bye-bye waves, clapping and other little gestures.',
    body: [
      'Imitation is one of toddlers’ most important learning strategies. Many babies now wave goodbye, clap their hands or join in with pat-a-cake. They enjoy games that always go the same way, so they know what comes next.',
      'By their first birthday, most children wave bye-bye.',
    ],
    tips: [
      'Play clapping and finger games the same way again and again.',
      'Wave goodbye together — to the bus or the moon, too.',
    ],
    sources: ['cdc1Year', 'cdc9Months'],
  },
  // Week 42
  {
    title: 'Fill, empty, bang',
    teaser:
      'Your baby bangs two blocks together, empties containers and fills them again — discovering cause and effect.',
    body: [
      'What happens if I drop this, bang it or put it inside? Babies this age are little researchers. They bang objects together, put things into containers and take them out again, learning a lot about sizes, sounds and sequences.',
      'You don’t need expensive toys for this: pots, wooden spoons and plastic tubs are ideal.',
    ],
    tips: [
      'Put together a “treasure basket” of safe everyday objects.',
      'Make a box with a hole for balls or blocks.',
    ],
    sources: ['cdc9Months', 'cdc1Year'],
  },
  // Week 43
  {
    title: 'Next check-up coming up',
    teaser:
      'In Germany the U6 check-up falls between months 10 and 12. Now is a good time to book it.',
    body: [
      'At this check-up the paediatrician looks at how your child moves — whether they sit, crawl or pull up — how they grasp, see, hear and interact with others. Nutrition, teeth, accident prevention and vaccination status are covered too.',
      'Around the first birthday further vaccinations are due again. Your practice will tell you which ones.',
    ],
    tips: [
      'Book early — many practices are booked up weeks ahead.',
      'Note down anything you’ve noticed recently, even small things.',
    ],
    sources: ['kgiCheckups', 'cdc1Year'],
  },
  // Week 44
  {
    title: 'The first word?',
    teaser:
      'Some children now say their first word — often “Mama”, “Dada” or their own name for something important.',
    body: [
      'A “first word” is a sound your child uses deliberately for a particular person or thing — even if it sounds different from the adult word (“woof” for dog). Many children say their first word around their first birthday, but the range runs from about ten to more than fifteen months.',
      'At this age, how much your child understands tells you more than how many words they say.',
    ],
    tips: [
      'Pick up your child’s words and repeat them correctly, without correcting: “Woof — yes, a dog!”',
      'Record the first word as a milestone — including what it means.',
    ],
    sources: ['cdc1Year', 'cdc15Months'],
  },
  // Week 45
  {
    title: 'Towards family meals',
    teaser: 'Towards the end of the first year your child can gradually join in with family meals.',
    body: [
      'Over the 10th to 12th month many children move from purées to finely chopped family food. Season sparingly: salt and sugar are only suitable for toddlers in small amounts. Water from a cup or glass is the best drink.',
      'Feeding themselves with their fingers and first attempts with a spoon are important for development — even if it gets messy.',
    ],
    tips: [
      'Set aside a portion for your child before seasoning.',
      'Offer water in a cup instead of a bottle.',
    ],
    sources: ['gesundInsLeben', 'cdc1Year'],
  },
  // Week 46
  {
    title: 'Standing alone for a moment',
    teaser:
      'For an instant your child lets go and stands all alone — often unnoticed, because they are busy with something else.',
    body: [
      'Standing freely takes a lot of balance. Many children stand alone for just seconds before grabbing on again or plopping onto their bottom. The WHO data show a wide range of about 7 to 17 months for this.',
      'Falling is part of it: a bump onto a padded bottom is usually harmless and part of learning.',
    ],
    tips: [
      'Encourage rather than pulling them along by the hands.',
      'Create a safe space with soft edges.',
    ],
    sources: ['whoMotorMilestones', 'nhsBabyMoves'],
  },
  // Week 47
  {
    title: 'Looking together',
    teaser:
      'Your child follows your gaze and your pointing finger — and will soon show you what they find exciting.',
    body: [
      'Joint attention — when you both look at the same thing and share it — is a cornerstone of language and social learning. Many children now follow your pointing and look back and forth between you and the object.',
      'Picture books are ideal for this: point at pictures together, name them, make the sounds.',
    ],
    tips: [
      'Plan a short picture-book time every day.',
      'Point at things and name them: “Look, a bird!”',
    ],
    sources: ['cdc1Year', 'cdc15Months'],
  },
  // Week 48
  {
    title: 'A will of their own',
    teaser:
      'Your child knows more and more precisely what they want — and what they don’t. Frustration and protest are part of it now.',
    body: [
      'The more your child can do and understand, the clearer their wishes become. When something doesn’t work or isn’t allowed, many react with loud protest. Toddlers can’t yet regulate their feelings on their own — they need you for that.',
      'Naming feelings (“You’re angry because you want the spoon”) helps your child understand them over time.',
    ],
    tips: [
      'Move hazards out of the way instead of having to say “no” all the time.',
      'Offer distraction and alternatives: “Not the spoon, but this cup.”',
    ],
    sources: ['cdc1Year', 'cdc15Months'],
  },
  // Week 49
  {
    title: 'First independent steps',
    teaser:
      'Some children take their first independent steps now. Others take many more months — both are normal.',
    body: [
      'Walking alone has the widest range of all motor milestones: according to the WHO study, healthy children learn it somewhere between about 8 and 18 months. Whether your child walks early or late says nothing about their later coordination or intelligence.',
      'First steps are wide-legged, arms raised, with plenty of falls. Balance improves with every attempt.',
    ],
    tips: [
      'Let them practise barefoot — it strengthens the foot muscles.',
      'When the time comes: record the first steps as a milestone (a video works too).',
    ],
    sources: ['whoMotorMilestones', 'cdc15Months'],
  },
  // Week 50
  {
    title: 'This is how it’s done',
    teaser:
      'Your child uses everyday objects “properly”: holding the phone to their ear, combing their hair or stirring a pot.',
    body: [
      'Children watch closely what grown-ups do with things and copy it. Towards their first birthday, many try out how a spoon, cup, brush or phone is used. This is the beginning of pretend play, which blossoms in the second year.',
      'Your child also wants to “help” around the house now — a good opportunity for time together.',
    ],
    tips: [
      'Offer toy versions of everyday objects or real, safe ones (a wooden spoon, a pot).',
      'Let them join in with tidying up or sorting laundry.',
    ],
    sources: ['cdc15Months', 'cdc1Year'],
  },
  // Week 51
  {
    title: 'Rituals give security',
    teaser:
      'Fixed routines around meals, sleep and goodbyes give your child security in a world full of new impressions.',
    body: [
      'Toddlers love repetition. When things happen in a familiar order, they can prepare for them — which makes transitions like bedtime or a goodbye easier.',
      'Many children still nap twice a day around their first birthday; some switch to one midday nap during their second year. How much sleep a child needs varies.',
    ],
    tips: [
      'A fixed bedtime ritual with the same steps in the same order.',
      'Keep goodbyes short, loving and always the same.',
    ],
    sources: ['kgiBabySleep', 'cdc1Year'],
  },
  // Week 52
  {
    title: 'A whole year',
    teaser:
      'The first birthday is almost here! The newborn has become a little person with a mind of their own.',
    body: [
      'In the first year your child has learned to make contact, laugh, grasp, roll, sit and get around, to use gestures and to understand a great deal. Some children are already walking, others are still crawling enthusiastically — both fit this age.',
      'From the first birthday, this development calendar switches from weeks to months: development now happens in bigger steps, and month-by-month descriptions are more meaningful. If it hasn’t happened yet, the next check-up is due around now.',
    ],
    tips: [
      'Look back on the year with photos — the milestone timeline in the app helps.',
      'Check the health record booklet: is the one-year check-up done?',
    ],
    sources: ['cdc1Year', 'kgiCheckups'],
  },
];

const months: readonly DevelopmentEntry[] = [
  // Month 13
  {
    title: 'Learning to walk at their own pace',
    teaser:
      'Whether your child is already walking or still crawling: in the second year they become more and more mobile — each at their own pace.',
    body: [
      'Many children take their first independent steps around their first birthday, but many only a few months later. According to the WHO, the range for walking alone is about 8 to 18 months. If your child isn’t walking independently by 18 months, talk to your paediatrician.',
      'For learning to walk outdoors your child needs light, flexible shoes with enough room for the toes. Indoors, barefoot is best.',
    ],
    tips: [
      'Use uneven ground outdoors, like grass or forest floor, for practice.',
      'Check shoe size regularly — children’s feet grow fast.',
    ],
    sources: ['whoMotorMilestones', 'cdc15Months'],
  },
  // Month 14
  {
    title: 'Understanding comes before speaking',
    teaser:
      'Your child understands much more than they can say. They look at familiar things when you name them.',
    body: [
      'By about 15 months, most children say one or two words besides “Mama” and “Dada”. But they already understand much more: they look for familiar objects when you name them and follow simple instructions given with a gesture (“Give me the ball”).',
      'The number of spoken words still varies greatly at this age.',
    ],
    tips: [
      'Play “Where’s the ball?” — and search together.',
      'Back up simple requests with a gesture.',
    ],
    sources: ['cdc15Months', 'cdc1Year'],
  },
  // Month 15
  {
    title: 'Pointing to ask',
    teaser: 'Your child points at what they want — and proudly shows you what they have found.',
    body: [
      'Around 15 months, most children point to ask for things, bring you objects to show you, clap when excited and stack two small objects. Many also take a few steps on their own.',
      'Further vaccinations are due during the second year. It’s worth a look at the vaccination record.',
    ],
    tips: [
      'Respond to pointing and put it into words: “You want the banana.”',
      'Offer blocks for stacking and knocking down.',
    ],
    sources: ['cdc15Months', 'rkiVaccinationSchedule'],
  },
  // Month 16
  {
    title: 'Copying and pretending',
    teaser:
      'Your child imitates your everyday activities: sweeping, phoning, cooking. Pretend play begins.',
    body: [
      'In their second year, children learn an enormous amount through imitation. They want to sweep with the broom, give the doll a drink or stir a pot with a wooden spoon. This “let’s pretend” is an important step for thinking, language and imagination.',
      'Simple toys that resemble real life are often more popular now than flashing electronics.',
    ],
    tips: [
      'Offer a doll, teddy, play kitchen — or simply real, safe household items.',
      'Join in the play: “Is teddy hungry?”',
    ],
    sources: ['cdc18Months', 'cdc15Months'],
  },
  // Month 17
  {
    title: 'Eating and drinking independently',
    teaser:
      'Your child wants to eat with a spoon by themselves and drink from an open cup — spills included.',
    body: [
      'By about 18 months, most children feed themselves with their fingers, try using a spoon and drink from a cup without a lid — even if quite a bit still misses. Independence at mealtimes strengthens fine motor skills and confidence.',
      'Toddlers should be allowed to decide how much they eat. Parents decide what is offered and when.',
    ],
    tips: [
      'Bib, wipe-clean mat — and a relaxed attitude.',
      'Offer water in an open cup rather than juice in a bottle.',
    ],
    sources: ['cdc18Months', 'gesundInsLeben'],
  },
  // Month 18
  {
    title: 'Eighteen months',
    teaser:
      'Your child walks, scribbles, climbs onto the sofa and follows simple requests — even without gestures.',
    body: [
      'By about 18 months, most children walk on their own, climb on and off chairs and sofas, scribble with crayons and say at least three words besides “Mama” and “Dada”. They follow simple directions like “Give it to me” and point to show you something interesting.',
      'If your child isn’t walking independently, uses hardly any words or doesn’t point at things by 18 months, raise it with your paediatrician — there is usually a harmless explanation, but looking early pays off.',
    ],
    tips: [
      'Offer chunky crayons and large paper for scribbling.',
      'Make climbing safe rather than forbidding it: padding, help getting down.',
    ],
    sources: ['cdc18Months', 'whoMotorMilestones'],
  },
  // Month 19
  {
    title: 'Going up: stairs',
    teaser:
      'Stairs are fascinating now. With help or holding the rail, your child can already manage a few steps.',
    body: [
      'Many children crawl up stairs before they can walk upright. During the second year most walk up a few stairs upright, with help or holding the rail. Going down is harder — it’s safest crawling backwards.',
      'Stair gates remain important until your child can manage stairs safely.',
    ],
    tips: [
      'Practise crawling down backwards together.',
      'Stairs only under supervision — keep using the gates.',
    ],
    sources: ['cdc2Years', 'cdc18Months'],
  },
  // Month 20
  {
    title: 'Me do it! The push for autonomy',
    teaser:
      'Your child is discovering their own will — and strong feelings. Tantrums are common now and completely normal.',
    body: [
      'From around the middle of the second year, many children enter a phase often called the “terrible twos” — experts prefer to talk about a push for autonomy. Your child wants to do things themselves but can’t yet manage many of them, and can’t yet regulate strong feelings. The result is anger, tears and throwing themselves on the floor.',
      'Tantrums are not a sign of bad parenting. Your child now needs calm support, clear limits and the feeling of being loved regardless.',
    ],
    tips: [
      'Stay calm, stay close and ride out the storm — explanations only help afterwards.',
      'Offer small choices: “Red jacket or blue jacket?”',
      'If it gets too much for you: look for support from a parenting advice service.',
    ],
    sources: ['cdc18Months', 'cdc2Years'],
  },
  // Month 21
  {
    title: 'Two-year check-up',
    teaser:
      'In Germany the U7 check-up falls between months 21 and 24 — with a special focus on movement and language.',
    body: [
      'At this check-up the paediatrician looks at how your child walks and climbs, how they use their hands, how they speak and understand and how they interact with other people. Teeth, nutrition, sleep and accident prevention are topics too.',
      'Many parents are thinking about language development now. The check-up is the right place to ask about it.',
    ],
    tips: [
      'Book the check-up in good time.',
      'Note down beforehand which words your child already says — it helps the conversation.',
    ],
    sources: ['kgiCheckups', 'cdc2Years'],
  },
  // Month 22
  {
    title: 'A growing vocabulary',
    teaser: 'Many children now learn new words almost daily and point to body parts when you ask.',
    body: [
      'Between eighteen months and two years, many children have a “vocabulary spurt”: new words suddenly arrive very quickly. When asked, most point to at least two body parts and to things in a picture book.',
      'Children learn language best in real conversation — while playing, eating, dressing and reading. Screens can’t replace that.',
    ],
    tips: [
      'Body-part games: “Where’s your nose?”',
      'Read aloud every day and talk about the pictures.',
    ],
    sources: ['cdc2Years', 'cdc18Months'],
  },
  // Month 23
  {
    title: 'Running and kicking',
    teaser:
      'Your child is getting steadier on their feet: they run, kick a ball and carry things around.',
    body: [
      'By their second birthday most children run, kick a ball and walk up a few stairs. They can hold something in one hand while using the other, and try out switches, buttons and knobs.',
      'Toddlers need plenty of movement: the WHO recommends at least three hours of activity of any kind, spread over the day, for one- to two-year-olds.',
    ],
    tips: [
      'Run around outdoors every day — playground, meadow, woods.',
      'Offer balls of different sizes for kicking and throwing.',
    ],
    sources: ['cdc2Years', 'nhsBabyMoves'],
  },
  // Month 24
  {
    title: 'Two years: first little sentences',
    teaser:
      'Many children now put two words together into little sentences like “more milk” or “Daddy gone”.',
    body: [
      'Around their second birthday, most children say at least two words together and use a wide range of words. They also use more gestures than just waving and pointing, such as nodding or blowing a kiss.',
      'If your child says fewer than about 50 words at two or isn’t combining two words yet, mention it to your paediatrician. Many of these “late talkers” catch up, but an early assessment helps support the others in a targeted way.',
    ],
    tips: [
      'Pick up two-word sentences and expand them: “More milk? You’d like more milk.”',
      'Record the first little sentence as a milestone.',
    ],
    sources: ['cdc2Years', 'kgiCheckups'],
  },
  // Month 25
  {
    title: 'Playing side by side',
    teaser:
      'Other children are becoming interesting. But two-year-olds mostly still play next to each other rather than with each other.',
    body: [
      'Children this age watch other children closely and like to play near them — often with similar things, but each on their own. Experts call this parallel play. Little by little it turns into short moments of playing together.',
      'Sharing is still hard because toddlers can barely put themselves in someone else’s shoes yet. That comes with time.',
    ],
    tips: [
      'Arrange playdates with other children — bring enough toys for everyone.',
      'Calmly help with squabbles over toys instead of forcing them to share.',
    ],
    sources: ['cdc30Months', 'cdc2Years'],
  },
  // Month 26
  {
    title: 'Skilful hands',
    teaser:
      'Unscrewing lids, turning pages one at a time, building towers: fine motor skills are making big progress.',
    body: [
      'Hands are getting more and more skilful: many children now twist lids and door handles, turn book pages one at a time and build taller towers. By 30 months most children can use their hands to twist and turn things.',
      'Drawing, play dough, shape sorters and puzzles with large pieces build these skills through play.',
    ],
    tips: [
      'Offer jars with screw lids (with something exciting inside) to open.',
      'Look at board books together and let your child turn the pages.',
    ],
    sources: ['cdc30Months', 'cdc2Years'],
  },
  // Month 27
  {
    title: 'Bye-bye nappies? No pressure',
    teaser:
      'Some children now show interest in the potty and the toilet. The right time is very individual.',
    body: [
      'Toilet training is a process of maturation: a child needs to feel and control their bladder and bowels. Most children become dry during the day somewhere between two and four years of age, often later at night. Training before they are ready achieves little, and pressure tends to backfire.',
      'Signs of readiness can include: your child notices they are going in the nappy, tells you, is interested in the toilet or stays dry for longer periods.',
    ],
    tips: [
      'Put out a potty and let your child decide whether to sit on it.',
      'Take accidents calmly — they are part of learning.',
    ],
    sources: ['cdc30Months', 'kgiHome'],
  },
  // Month 28
  {
    title: 'Imagination and “me”',
    teaser:
      'A block becomes a phone, a box becomes a car — and your child talks about themselves as “I” and “me”.',
    body: [
      'Pretend play gets more imaginative: objects stand in for something else, and little scenes get acted out. Many children start using words like “I”, “me” and “we” — a sign that they see themselves as a person in their own right.',
      'Children also show simple problem-solving now, such as climbing on a small stool to reach something.',
    ],
    tips: [
      'Offer open-ended toys: boxes, cloths, building blocks.',
      'Join in role play and let your child take the lead.',
    ],
    sources: ['cdc30Months', 'cdc2Years'],
  },
  // Month 29
  {
    title: 'Jumping with both feet',
    teaser: 'Many children now jump off the ground with both feet at once — and love it.',
    body: [
      'By 30 months most children jump off the ground with both feet. Movement is central to toddler development: running, climbing, jumping and balancing build not only motor skills but also concentration and confidence.',
      'The WHO advises no screen time for children under two and no more than one hour a day for two-year-olds; German guidance recommends keeping children under three away from screens as far as possible. For movement, language and sleep, real play is far more valuable.',
    ],
    tips: [
      'Jumping games: puddles, cushions on the floor, chalk circles.',
      'Screen-free times for the whole family, e.g. at meals and before bed.',
    ],
    sources: ['cdc30Months', 'kgiHome'],
  },
  // Month 30
  {
    title: 'Two and a half',
    teaser:
      'Your child speaks in short sentences, follows two-step instructions and may already know a colour.',
    body: [
      'By about 30 months, most children say around 50 words or more and combine words with actions (“doggy run”). They follow two-step instructions (“Get your shoes and sit down”) and name things in a picture book when you point and ask.',
      'By two and a half to three years the set of baby teeth is usually complete. From the second birthday, brush with a pea-sized amount of fluoride toothpaste — parents keep brushing after the child.',
    ],
    tips: [
      'Set two-step tasks playfully: “Take teddy and put him to bed.”',
      'Name colours in everyday life without quizzing.',
    ],
    sources: ['cdc30Months', 'cdc2Years'],
  },
  // Month 31
  {
    title: 'What’s that? Why?',
    teaser:
      'The age of questions begins: your child wants to know what things are called — and soon why they are the way they are.',
    body: [
      'Towards the end of their third year, children ask more and more questions: “What’s that?”, “Where’s Grandma?” and finally the famous “Why?”. Questions are a sign of curiosity and growing thinking skills.',
      'The answers don’t always have to be perfect. What matters is that your child feels their questions are welcome.',
    ],
    tips: ['Ask back: “What do you think?”', 'Look for answers in books together.'],
    sources: ['cdc3Years', 'cdc30Months'],
  },
  // Month 32
  {
    title: 'Getting dressed',
    teaser:
      'Hat off, socks off, jacket on: your child more and more often wants to dress and undress themselves.',
    body: [
      'Undressing usually works before dressing. By 30 months many children take off some clothes by themselves, and by three most put on loose clothing like elastic-waist trousers or a jacket by themselves.',
      'Independence takes time — allow a few extra minutes in the morning.',
    ],
    tips: [
      'Clothes with big buttons, Velcro and elastic waists make practice easier.',
      'Lay out clothes in the order they go on.',
    ],
    sources: ['cdc30Months', 'cdc3Years'],
  },
  // Month 33
  {
    title: 'First friendships',
    teaser:
      'Your child now plays with other children more often rather than just beside them — first friendships are forming.',
    body: [
      'Towards the end of the third year, most children notice other children and join them to play. Shared role play, chasing and building become possible. Conflicts are part of it — and a practice ground for consideration and compromise.',
      'For many children, nursery starts around this time, or they move to a new group. A gentle settling-in period with a familiar person helps.',
    ],
    tips: [
      'Arrange regular meet-ups with the same children.',
      'In squabbles, name the feelings and look for solutions together.',
    ],
    sources: ['cdc3Years', 'cdc30Months'],
  },
  // Month 34
  {
    title: 'Three-year check-up',
    teaser:
      'In Germany the U7a check-up falls between months 34 and 36 — including an eye test and a look at language.',
    body: [
      'At this check-up the paediatrician pays particular attention to vision (to detect problems such as a “lazy eye” early), language development, behaviour and teeth. Vaccinations are reviewed too.',
      'Dental check-ups for young children run alongside and are also covered by German statutory health insurance.',
    ],
    tips: [
      'Book the check-up and bring the vaccination record.',
      'Note down questions about language, sleep or behaviour beforehand.',
    ],
    sources: ['kgiCheckups', 'cdc3Years'],
  },
  // Month 35
  {
    title: 'Circles, beads, fork',
    teaser: 'Your child copies a circle, threads large beads and eats with a fork.',
    body: [
      'By about three, most children can draw a circle when you show them how, string large beads onto a cord and eat with a fork. They also understand warnings like “Careful, hot!” and heed them.',
      'Fine motor skills develop very differently from child to child — plenty of opportunities for drawing, crafting and building are the best support.',
    ],
    tips: [
      'Offer large wooden beads and a sturdy cord for threading.',
      'Draw circles, suns and faces together.',
    ],
    sources: ['cdc3Years', 'cdc30Months'],
  },
  // Month 36
  {
    title: 'Almost three: real conversations',
    teaser:
      'Your child holds little conversations, says their first name and is mostly understood even by strangers.',
    body: [
      'By three, most children hold conversations with several back-and-forth exchanges, ask “who, what, where, why” questions, say their first name and describe what is happening in a picture. Usually they speak clearly enough that people outside the family understand most of what they say.',
      'This is where the development calendar ends. In Germany the next preventive check-ups are the U8 (at almost four) and the U9 (at almost five). The CDC milestone checklists continue up to five years.',
    ],
    tips: [
      'Give your child time when they tell you something, and show interest — even in long stories.',
      'Look back on three years: the milestone timeline shows how much has happened.',
    ],
    sources: ['cdc3Years', 'kgiCheckups'],
  },
];

export const developmentContent: DevelopmentContent = { weeks, months };
