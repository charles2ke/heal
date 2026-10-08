// The United Nations Sustainable Development Goals, adopted by all UN member
// states in 2015, with practical ways one person can help with each.
// Goal names are the official short titles; summaries and actions are our own.
// Action ids are stable: saved pledges refer to them.

export const ACTION_TYPES = Object.freeze({
  time: 'Give time',
  give: 'Donate',
  voice: 'Speak up',
  habit: 'Everyday habit',
});

export const GOALS = Object.freeze([
  {
    number: 1,
    name: 'No Poverty',
    summary: 'End poverty in every form, everywhere.',
    actions: [
      { id: 'g1-volunteer-locally', type: 'time', text: 'Volunteer with a local group that supports people on low incomes.' },
      { id: 'g1-donate-essentials', type: 'give', text: 'Donate toiletries, warm clothes or baby essentials to a local charity.' },
      { id: 'g1-ask-representative', type: 'voice', text: 'Ask your local representative what is being done about poverty where you live.' },
    ],
  },
  {
    number: 2,
    name: 'Zero Hunger',
    summary: 'End hunger and make sure everyone can get enough nutritious food.',
    actions: [
      { id: 'g2-food-bank', type: 'give', text: 'Add a few items to a food bank collection point when you shop.' },
      { id: 'g2-waste-less-food', type: 'habit', text: 'Plan meals and use up leftovers so less food goes to waste.' },
      { id: 'g2-community-meal', type: 'time', text: 'Help to cook or serve at a community meal.' },
    ],
  },
  {
    number: 3,
    name: 'Good Health and Well-being',
    summary: 'Healthy lives and well-being for people of every age.',
    actions: [
      { id: 'g3-move-daily', type: 'habit', text: 'Move in a way that suits you for at least 20 minutes a day.' },
      { id: 'g3-talk-mental-health', type: 'voice', text: 'Talk openly about mental health so others feel able to ask for help.' },
      { id: 'g3-health-charity', type: 'give', text: 'Support a health charity that works where care is hardest to reach.' },
    ],
  },
  {
    number: 4,
    name: 'Quality Education',
    summary: 'Fair, inclusive, good-quality education and lifelong learning for all.',
    actions: [
      { id: 'g4-mentor', type: 'time', text: 'Mentor, tutor or read with a young person.' },
      { id: 'g4-donate-books', type: 'give', text: 'Donate books or school supplies to a school, library or family that needs them.' },
      { id: 'g4-learn-daily', type: 'habit', text: 'Spend 15 minutes a day learning something new.' },
    ],
  },
  {
    number: 5,
    name: 'Gender Equality',
    summary: 'Equal rights, safety and opportunities for women and girls.',
    actions: [
      { id: 'g5-challenge-stereotypes', type: 'voice', text: 'Challenge sexist jokes and stereotypes when you hear them.' },
      { id: 'g5-share-care', type: 'habit', text: 'Share housework and caring fairly at home.' },
      { id: 'g5-support-women', type: 'give', text: 'Support organisations that help women and girls to be safe and to thrive.' },
    ],
  },
  {
    number: 6,
    name: 'Clean Water and Sanitation',
    summary: 'Safe water and sanitation for everyone.',
    actions: [
      { id: 'g6-save-water', type: 'habit', text: 'Take shorter showers and turn off the tap while you brush your teeth.' },
      { id: 'g6-protect-drains', type: 'habit', text: 'Keep oil, wipes and chemicals out of sinks, drains and toilets.' },
      { id: 'g6-water-charity', type: 'give', text: 'Support a charity that brings clean water and toilets to communities without them.' },
    ],
  },
  {
    number: 7,
    name: 'Affordable and Clean Energy',
    summary: 'Affordable, reliable and clean energy for all.',
    actions: [
      { id: 'g7-switch-off', type: 'habit', text: "Switch off lights and unplug devices you aren't using." },
      { id: 'g7-wash-cool', type: 'habit', text: 'Wash clothes at a lower temperature and air-dry them when you can.' },
      { id: 'g7-ask-renewables', type: 'voice', text: 'Ask your energy supplier, landlord or workplace about switching to renewable energy.' },
    ],
  },
  {
    number: 8,
    name: 'Decent Work and Economic Growth',
    summary: 'Decent, fairly paid work for everyone, and growth that lasts.',
    actions: [
      { id: 'g8-buy-local', type: 'habit', text: 'Buy from local and independent businesses when you can.' },
      { id: 'g8-ask-brands', type: 'voice', text: 'Ask brands how they treat the people who make their products.' },
      { id: 'g8-job-help', type: 'time', text: 'Help someone with a CV, an application or interview practice.' },
    ],
  },
  {
    number: 9,
    name: 'Industry, Innovation and Infrastructure',
    summary: 'Resilient infrastructure, fair industry and innovation that serves people.',
    actions: [
      { id: 'g9-repair', type: 'habit', text: 'Repair before you replace: mend it yourself or visit a repair café.' },
      { id: 'g9-digital-help', type: 'time', text: 'Help someone get online or learn a new digital skill.' },
      { id: 'g9-donate-devices', type: 'give', text: 'Donate working phones or laptops to a scheme that passes them on.' },
    ],
  },
  {
    number: 10,
    name: 'Reduced Inequalities',
    summary: 'Less inequality within and between countries.',
    actions: [
      { id: 'g10-speak-up', type: 'voice', text: 'Speak up when you see someone treated unfairly because of who they are.' },
      { id: 'g10-listen-learn', type: 'habit', text: 'Read or listen to the experiences of people whose lives differ from yours.' },
      { id: 'g10-welcome-refugees', type: 'give', text: 'Support a group that welcomes refugees and people new to your area.' },
    ],
  },
  {
    number: 11,
    name: 'Sustainable Cities and Communities',
    summary: 'Safe, inclusive and sustainable places to live.',
    actions: [
      { id: 'g11-walk-cycle', type: 'habit', text: 'Walk, cycle or take public transport for short journeys.' },
      { id: 'g11-community-garden', type: 'time', text: 'Help at a community garden or a neighbourhood clean-up.' },
      { id: 'g11-local-meeting', type: 'voice', text: "Go to a local council or residents' meeting and have your say." },
    ],
  },
  {
    number: 12,
    name: 'Responsible Consumption and Production',
    summary: 'Use what we have well, and waste less.',
    actions: [
      { id: 'g12-reusables', type: 'habit', text: 'Carry a reusable bottle, cup and bag.' },
      { id: 'g12-borrow-first', type: 'habit', text: 'Before you buy something new, see whether you can borrow, rent or buy second-hand.' },
      { id: 'g12-pass-it-on', type: 'give', text: 'Give things you no longer need a second life through a charity shop or a giveaway group.' },
    ],
  },
  {
    number: 13,
    name: 'Climate Action',
    summary: 'Urgent action on climate change and its effects.',
    actions: [
      { id: 'g13-plant-based', type: 'habit', text: 'Eat more plant-based meals each week.' },
      { id: 'g13-talk-climate', type: 'voice', text: 'Talk about climate change with friends and family. Conversations change minds.' },
      { id: 'g13-plant-trees', type: 'time', text: 'Join a local tree-planting or rewilding day.' },
    ],
  },
  {
    number: 14,
    name: 'Life Below Water',
    summary: 'Healthy oceans, seas and marine life.',
    actions: [
      { id: 'g14-skip-plastic', type: 'habit', text: 'Avoid single-use plastics, which often end up in rivers and the sea.' },
      { id: 'g14-shore-clean', type: 'time', text: 'Join a beach or riverbank clean-up.' },
      { id: 'g14-ocean-charity', type: 'give', text: 'Support an organisation that protects oceans and marine wildlife.' },
    ],
  },
  {
    number: 15,
    name: 'Life on Land',
    summary: 'Protect forests, land and wildlife, and halt the loss of nature.',
    actions: [
      { id: 'g15-wild-corner', type: 'habit', text: 'Leave a corner of a garden or balcony wild for insects and birds.' },
      { id: 'g15-wildlife-count', type: 'time', text: 'Take part in a wildlife count or another citizen-science survey.' },
      { id: 'g15-protect-habitats', type: 'give', text: 'Support a group that protects forests, wetlands or other wild places.' },
    ],
  },
  {
    number: 16,
    name: 'Peace, Justice and Strong Institutions',
    summary: 'Peaceful, fair societies, justice for all and institutions that answer to people.',
    actions: [
      { id: 'g16-vote', type: 'voice', text: 'Register to vote if you are eligible, and use your vote.' },
      { id: 'g16-check-sources', type: 'habit', text: 'Check sources before you share news, and correct misinformation kindly.' },
      { id: 'g16-advice-service', type: 'time', text: 'Volunteer with an advice service, a victim support group or a mediation scheme.' },
    ],
  },
  {
    number: 17,
    name: 'Partnerships for the Goals',
    summary: 'Work together across borders and sectors to reach every goal.',
    actions: [
      { id: 'g17-share-goals', type: 'voice', text: 'Tell someone about the Global Goals and choose one to work on together.' },
      { id: 'g17-give-regularly', type: 'give', text: 'Give regularly, even a small amount, to a charity whose work you have checked.' },
      { id: 'g17-join-group', type: 'time', text: 'Join or start a local group working on one of the goals.' },
    ],
  },
]);

export function goalUrl(number) {
  return `https://sdgs.un.org/goals/goal${number}`;
}
