# Source of truth for the hand-authored roster.
#
# Stats are written as rough 1-10 shapes; build.py rescales each figure to the
# exact point budget of its power tier, so the shape is what matters here and
# the arithmetic is not the author's problem.
#
# cols: id, name, country, era, office, bio, traits, tier, alignment, category,
#       (charisma, cunning, integrity, grit, intellect, force)

GOOD = 'good'; BAD = 'bad'; NEU = 'neutral'
POL = 'politician'; WILD = 'wildcard'; OBJ = 'object'

R = []
def add(id, name, country, era, office, bio, traits, tier, align, cat, stats, **kw):
    R.append(dict(id=id, name=name, country=country, era=era, office=office, bio=bio,
                  traits=traits, tier=tier, alignment=align, category=cat, stats=stats, **kw))

# ---------------------------------------------------------------- good leaders
add('lincoln','Abraham Lincoln','United States','1860s','President',
    'Keeps his rivals in the cabinet and his temper in a drawer.',
    ['beloved','statesman','strategist'],'titan',GOOD,POL,(8,7,9,10,9,4))
add('eleanor-roosevelt','Eleanor Roosevelt','United States','1940s','First Lady, UN Delegate',
    'The only person in the cabinet who has read the whole document.',
    ['beloved','statesman','loyalist'],'heavyweight',GOOD,POL,(8,3,10,8,9,2))
add('churchill','Winston Churchill','United Kingdom','1940s','Prime Minister',
    'Will not surrender, will not go to bed, will not stop dictating.',
    ['statesman','warhawk','showman'],'titan',GOOD,POL,(9,6,5,10,7,8))
add('mandela','Nelson Mandela','South Africa','1990s','President',
    'Twenty-seven years in a cell and somehow the least bitter man in the room.',
    ['beloved','statesman','dealmaker'],'titan',GOOD,POL,(9,6,10,10,7,3))
add('gandhi','Mohandas Gandhi','India','1930s','Independence Leader',
    'Refuses to eat until you reconsider, and he can keep this up for weeks.',
    ['beloved','statesman','isolationist'],'heavyweight',GOOD,POL,(8,6,10,10,7,1))
add('ataturk','Mustafa Kemal Atatürk','Turkey','1920s','President',
    'Rebuilt a country from scratch and changed the alphabet while he was at it.',
    ['statesman','soldier','strategist'],'titan',GOOD,POL,(8,7,7,9,9,8))
add('marcus-aurelius','Marcus Aurelius','Rome','Antiquity','Emperor',
    'Runs an empire by day and writes anxious diary entries about it by night.',
    ['statesman','technocrat','loyalist'],'heavyweight',GOOD,POL,(6,5,10,9,10,5))
add('ashoka','Ashoka','India','Antiquity','Emperor',
    'Conquered everything, felt terrible about it, carved the apology into rocks.',
    ['statesman','beloved','strategist'],'heavyweight',GOOD,POL,(7,6,9,8,8,7))
add('elizabeth-i','Elizabeth I','England','1500s','Queen',
    'Answers every question in a way that commits her to nothing.',
    ['statesman','cunning','showman'],'titan',GOOD,POL,(9,10,6,9,9,5))
add('fdr','Franklin D. Roosevelt','United States','1930s','President',
    'Will explain the crisis to the nation as if you were all sitting by his fire.',
    ['beloved','showman','statesman'],'titan',GOOD,POL,(10,8,6,9,8,6))
add('ardern','Jacinda Ardern','New Zealand','Modern','Prime Minister',
    'Turns up, says the obviously decent thing, and means it.',
    ['beloved','statesman','dealmaker'],'operator',GOOD,POL,(9,5,9,7,7,2))
add('lee-kuan-yew','Lee Kuan Yew','Singapore','1970s','Prime Minister',
    'Built a first-world country and fined it for chewing gum.',
    ['technocrat','statesman','strategist'],'heavyweight',GOOD,POL,(6,8,7,9,10,6))
add('attlee','Clement Attlee','United Kingdom','1940s','Prime Minister',
    'Rebuilt the country without once raising his voice or being remembered.',
    ['technocrat','statesman','loyalist'],'operator',GOOD,POL,(3,6,9,8,9,4))
add('allende','Salvador Allende','Chile','1970s','President',
    'Elected, obstructed, and eventually shelled.',
    ['statesman','beloved','loyalist'],'flawed',GOOD,POL,(8,4,9,8,7,4))
add('havel','Václav Havel','Czechia','1990s','President',
    'A playwright who accidentally won, and then did the job properly.',
    ['beloved','statesman','showman'],'operator',GOOD,POL,(8,5,9,7,9,2))
add('golda-meir','Golda Meir','Israel','1970s','Prime Minister',
    'Runs the war cabinet out of her kitchen and does not care for your opinion.',
    ['statesman','warhawk','strategist'],'heavyweight',GOOD,POL,(7,8,6,10,8,7))
add('bolivar','Simón Bolívar','Venezuela','1820s','Liberator',
    'Liberated six countries and could not get any of them to agree on lunch.',
    ['soldier','showman','statesman'],'heavyweight',GOOD,POL,(9,7,7,9,7,8))
add('toussaint','Toussaint Louverture','Haiti','1790s','Governor-General',
    'Out-generalled three empires with an army that started as a rumour.',
    ['soldier','strategist','statesman'],'heavyweight',GOOD,POL,(7,9,8,10,8,8))
add('kofi-annan','Kofi Annan','Ghana','2000s','UN Secretary-General',
    'Can get two people who hate each other to sign the same piece of paper.',
    ['dealmaker','statesman','beloved'],'operator',GOOD,POL,(7,8,9,7,8,2))
add('sankara','Thomas Sankara','Burkina Faso','1980s','President',
    'Sold the government limousines and cycled to work.',
    ['beloved','statesman','soldier'],'operator',GOOD,POL,(9,5,10,8,7,6))

# ----------------------------------------------------------------- bad leaders
add('nixon','Richard Nixon','United States','1970s','President',
    'Appointing him ends your government immediately. He has done this before.',
    ['paranoid','cunning','scandal-magnet'],'flawed',BAD,POL,(5,10,1,7,8,6),
    endsRun='Eighteen and a half minutes of the tape are missing. So is your government.')
add('genghis','Genghis Khan','Mongol Empire','Medieval','Great Khan',
    'Outstanding logistics. Do not give him the word "escalate".',
    ['warhawk','soldier','strategist'],'titan',BAD,POL,(5,7,3,9,6,10))
add('stalin','Joseph Stalin','Soviet Union','1930s','General Secretary',
    'Remembers everything anyone has ever said, and files it.',
    ['paranoid','cunning','strategist'],'titan',BAD,POL,(5,10,1,9,7,9))
add('mao','Mao Zedong','China','1960s','Chairman',
    'Has a big idea about agriculture and will not be talked out of it.',
    ['demagogue','strategist','paranoid'],'titan',BAD,POL,(8,9,2,9,6,8))
add('pol-pot','Pol Pot','Cambodia','1970s','General Secretary',
    'Abolished money, cities and the calendar. Considers this a strong start.',
    ['paranoid','demagogue','isolationist'],'heavyweight',BAD,POL,(4,8,1,8,4,9))
add('mussolini','Benito Mussolini','Italy','1930s','Prime Minister',
    'Jaw first, plan later.',
    ['demagogue','showman','warhawk'],'flawed',BAD,POL,(9,5,2,6,4,8))
add('franco','Francisco Franco','Spain','1950s','Caudillo',
    'Outlives everyone by refusing to be interesting.',
    ['paranoid','soldier','isolationist'],'operator',BAD,POL,(3,8,2,9,6,8))
add('idi-amin','Idi Amin','Uganda','1970s','President',
    'Awarded himself every medal in the building, then some from other buildings.',
    ['showman','warhawk','paranoid'],'flawed',BAD,POL,(7,5,1,7,3,9))
add('ceausescu','Nicolae Ceaușescu','Romania','1980s','General Secretary',
    'Demolished a third of the capital to build a palace he found slightly small.',
    ['paranoid','demagogue','showman'],'flawed',BAD,POL,(5,7,1,7,4,7))
add('pinochet','Augusto Pinochet','Chile','1970s','President',
    'Arrived by helicopter, stayed seventeen years.',
    ['soldier','paranoid','technocrat'],'operator',BAD,POL,(4,8,1,8,6,9))
add('kim-il-sung','Kim Il-sung','North Korea','1950s','Supreme Leader',
    'Still holds the office. Has been dead since 1994.',
    ['demagogue','paranoid','showman'],'heavyweight',BAD,POL,(8,8,1,8,5,8))
add('duvalier','François Duvalier','Haiti','1960s','President for Life',
    'A country doctor who decided the country was the patient.',
    ['paranoid','demagogue','cunning'],'flawed',BAD,POL,(6,8,1,7,6,7))
add('gaddafi','Muammar Gaddafi','Libya','1980s','Brotherly Leader',
    'Travels with a tent, a female bodyguard corps, and a book he wrote.',
    ['showman','demagogue','paranoid'],'operator',BAD,POL,(8,7,2,7,5,8))
add('saddam','Saddam Hussein','Iraq','1990s','President',
    'Commissioned a novel, a mosque and several statues, all of himself.',
    ['paranoid','warhawk','demagogue'],'heavyweight',BAD,POL,(6,8,1,9,6,9))
add('bokassa','Jean-Bédel Bokassa','Central African Republic','1970s','Emperor',
    'Spent a third of the national budget crowning himself.',
    ['showman','warhawk','paranoid'],'flawed',BAD,POL,(6,4,1,6,3,8))
add('mobutu','Mobutu Sese Seko','Zaire','1980s','President',
    'Renamed the country, the river, and himself. Kept the money.',
    ['cunning','showman','dealmaker'],'operator',BAD,POL,(7,9,1,7,6,7))
add('marcos','Ferdinand Marcos','Philippines','1980s','President',
    'Declared martial law and left behind three thousand pairs of shoes.',
    ['cunning','demagogue','banker'],'operator',BAD,POL,(7,9,1,7,7,6))
add('niyazov','Saparmurat Niyazov','Turkmenistan','1990s','President for Life',
    'Renamed the months of the year after himself and his mother.',
    ['showman','demagogue','paranoid'],'flawed',BAD,POL,(6,6,1,6,4,6))
add('leopold-ii','Leopold II','Belgium','1880s','King',
    'Ran a country as a private business and never once visited it.',
    ['banker','cunning','isolationist'],'heavyweight',BAD,POL,(5,10,1,8,8,7))
add('caligula','Caligula','Rome','Antiquity','Emperor',
    'Made his horse a senator. The horse was, by most accounts, an improvement.',
    ['showman','paranoid','demagogue'],'flawed',BAD,POL,(7,4,1,5,3,8))
add('vlad','Vlad the Impaler','Wallachia','Medieval','Voivode',
    'Has a preferred solution and applies it consistently.',
    ['warhawk','paranoid','soldier'],'operator',BAD,POL,(5,7,2,9,5,10))
add('robespierre','Maximilien Robespierre','France','1790s','Committee of Public Safety',
    'Incorruptible, tireless, and running out of people he trusts.',
    ['paranoid','demagogue','statesman'],'operator',BAD,POL,(8,7,4,8,8,7))

# ---------------------------------------------------- the forgettable middle
add('chamberlain','Neville Chamberlain','United Kingdom','1930s','Prime Minister',
    'Brings an umbrella to every crisis and a signature to most of them.',
    ['statesman','isolationist','dealmaker'],'flawed',NEU,POL,(4,4,7,4,6,2))
add('bismarck','Otto von Bismarck','Prussia','1870s','Chancellor',
    'Has already arranged the war you have not yet decided to start.',
    ['strategist','cunning','statesman'],'titan',NEU,POL,(6,10,4,8,9,7))
add('caesar','Julius Caesar','Rome','Antiquity','Dictator',
    'Excellent general, adequate delegator, catastrophic at reading a room.',
    ['soldier','strategist','showman','cunning'],'titan',NEU,POL,(9,9,3,9,8,9))
add('cleopatra','Cleopatra VII','Egypt','Antiquity','Pharaoh',
    'Arrives by boat, leaves with your navy.',
    ['dealmaker','showman','cunning'],'heavyweight',NEU,POL,(10,9,4,6,7,4))
add('hamilton','Alexander Hamilton','United States','1790s','Secretary of the Treasury',
    'Will fix the national debt and publish a pamphlet about his personal life.',
    ['technocrat','banker','scandal-magnet'],'heavyweight',NEU,POL,(7,6,5,8,10,4))
add('hearst','William Randolph Hearst','United States','1900s','Congressman, Publisher',
    'You furnish the crisis, he will furnish the coverage.',
    ['demagogue','showman','scandal-magnet'],'operator',NEU,POL,(7,9,2,6,6,5))
add('crassus','Marcus Licinius Crassus','Rome','Antiquity','Consul',
    'Richest man in Rome. Owns the fire brigade. Will negotiate at the fire.',
    ['banker','dealmaker','paranoid'],'flawed',NEU,POL,(4,8,2,6,7,5))
add('talleyrand','Charles-Maurice de Talleyrand','France','1800s','Foreign Minister',
    'Has served every regime France has had, and outlived most of them.',
    ['dealmaker','cunning','loyalist'],'heavyweight',NEU,POL,(7,10,2,7,9,5))

# --------------------------------------------------------------- wildcards
W = [
 ('freddy-fazbear','Freddy Fazbear','Fictional','Fictional','Animatronic Entertainer',
  'Runs on rails, works nights, has never been talked down from anything.',
  ['showman','soldier','paranoid'],'operator',(6,5,3,10,3,9)),
 ('markiplier','Markiplier','United States','Internet','YouTuber',
  'Can hold a room for nine hours and has the vocal cords to prove it.',
  ['showman','beloved','loyalist'],'operator',(10,5,8,9,6,2)),
 ('mrbeast','MrBeast','United States','Internet','Philanthropist, Content Machine',
  'Will solve the budget crisis, but everyone has to stand in a circle first.',
  ['banker','dealmaker','showman'],'operator',(8,8,6,8,8,3)),
 ('gordon-ramsay','Gordon Ramsay','United Kingdom','Modern','Chef',
  'Extremely effective under pressure, unusable in a press conference.',
  ['warhawk','soldier','showman'],'operator',(8,2,6,9,6,9)),
 ('bob-ross','Bob Ross','United States','1980s','Painter, former Master Sergeant',
  'Twenty years in the military and has not raised his voice since.',
  ['beloved','statesman','loyalist'],'operator',(8,4,10,8,9,1)),
 ('darth-vader','Darth Vader','Fictional','Fictional','Sith Lord',
  'Outstanding at ending negotiations. Less good at starting them.',
  ['warhawk','soldier','paranoid','strategist'],'heavyweight',(5,7,2,9,7,10)),
 ('keanu-reeves','Keanu Reeves','Canada','Modern','Actor',
  'Universally trusted, which in this cabinet is a structural advantage.',
  ['beloved','loyalist','statesman'],'operator',(8,2,10,8,5,4)),
 ('kermit','Kermit the Frog','Fictional','Fictional','Theatre Manager',
  'Has spent his whole career keeping louder people in one building.',
  ['dealmaker','beloved','loyalist'],'operator',(8,6,9,7,6,2)),
 ('shrek','Shrek','Fictional','Fictional','Swamp Proprietor',
  'Wants everyone out of his swamp, including the delegation.',
  ['isolationist','soldier','beloved'],'operator',(5,4,8,9,5,9)),
 ('gandalf','Gandalf','Fictional','Fictional','Wizard, Consultant',
  'Arrives precisely when he means to, which is never when you booked him.',
  ['statesman','strategist','beloved'],'heavyweight',(8,8,9,9,10,7)),
 ('sauron','Sauron','Fictional','Fictional','Dark Lord',
  'Cannot delegate, cannot compromise, cannot be reached by phone.',
  ['warhawk','paranoid','strategist'],'heavyweight',(3,9,1,10,8,10)),
 ('yoda','Yoda','Fictional','Fictional','Grand Master',
  'Nine hundred years of wisdom, delivered in an order nobody can parse.',
  ['statesman','strategist','loyalist'],'heavyweight',(6,8,9,10,10,6)),
 ('batman','Batman','Fictional','Fictional','Vigilante',
  'Has a contingency plan for every member of this cabinet, including himself.',
  ['paranoid','strategist','soldier'],'heavyweight',(4,10,7,9,9,8)),
 ('joker','The Joker','Fictional','Fictional','Agent of Chaos',
  'Does not want anything, which makes him impossible to negotiate with.',
  ['demagogue','showman','paranoid'],'flawed',(8,9,1,7,6,8)),
 ('homer-simpson','Homer Simpson','Fictional','Fictional','Safety Inspector',
  'Has already fallen asleep at the console.',
  ['beloved','liability','showman'],'liability',(5,2,5,5,2,4)),
 ('mr-burns','Montgomery Burns','Fictional','Fictional','Plant Owner',
  'Owns everything and can lift almost none of it.',
  ['banker','cunning','paranoid'],'flawed',(3,10,1,4,8,2)),
 ('spongebob','SpongeBob SquarePants','Fictional','Fictional','Fry Cook',
  'Relentlessly willing. Absolutely no judgement whatsoever.',
  ['beloved','loyalist','showman'],'flawed',(8,2,9,10,3,3)),
 ('patrick-star','Patrick Star','Fictional','Fictional','Rock Resident',
  'Is not currently thinking about anything, and says so.',
  ['liability','beloved','loyalist'],'liability',(5,1,7,6,1,4)),
 ('bowser','Bowser','Fictional','Fictional','Koopa King',
  'Has a plan. The plan is a fortress with lava in it.',
  ['warhawk','soldier','showman'],'operator',(6,5,3,9,4,10)),
 ('mario','Mario','Fictional','Fictional','Plumber',
  'Has personally saved this kingdom eleven times and never asked for a title.',
  ['beloved','loyalist','soldier'],'operator',(7,4,9,10,5,7)),
 ('godzilla','Godzilla','Fictional','Fictional','Force of Nature',
  'Cannot be appointed so much as noticed.',
  ['warhawk','soldier','isolationist'],'titan',(6,2,5,10,3,10)),
 ('optimus-prime','Optimus Prime','Fictional','Fictional','Autobot Commander',
  'Will give a speech about freedom and then personally handle the logistics.',
  ['statesman','soldier','beloved'],'heavyweight',(8,6,9,9,7,9)),
 ('thanos','Thanos','Fictional','Fictional','Titan',
  'Has run the numbers. The numbers are the problem.',
  ['warhawk','technocrat','strategist'],'heavyweight',(5,8,3,9,8,10)),
 ('hal-9000','HAL 9000','Fictional','Fictional','Onboard Systems',
  'Is afraid you are making a mistake, and has already acted on that.',
  ['technocrat','paranoid','cunning'],'operator',(3,10,2,8,10,6)),
 ('glados','GLaDOS','Fictional','Fictional','Facility Administrator',
  'Runs a rigorous testing programme with an unusually high attrition rate.',
  ['technocrat','cunning','demagogue'],'operator',(6,10,1,8,10,5)),
 ('sherlock','Sherlock Holmes','United Kingdom','1890s','Consulting Detective',
  'Will solve the crisis and be insufferable about the timeline.',
  ['strategist','technocrat','paranoid'],'heavyweight',(5,9,6,7,10,5)),
 ('dracula','Count Dracula','Fictional','Fictional','Voivode, Landlord',
  'Excellent host. Terrible daytime availability.',
  ['cunning','showman','isolationist'],'operator',(8,9,2,8,7,7)),
 ('winnie-the-pooh','Winnie-the-Pooh','Fictional','Fictional','Bear of Very Little Brain',
  'Means extremely well and is thinking about lunch.',
  ['beloved','loyalist','liability'],'liability',(7,1,9,5,1,2)),
 ('gollum','Gollum','Fictional','Fictional','Guide',
  'Two positions on every issue, and both of them are his.',
  ['paranoid','cunning','liability'],'flawed',(3,8,1,9,4,5)),
 ('voldemort','Lord Voldemort','Fictional','Fictional','Dark Lord',
  'Cannot be named, cannot be reasoned with, cannot delegate a single task.',
  ['paranoid','demagogue','warhawk'],'heavyweight',(6,9,1,8,8,10)),
 ('umbridge','Dolores Umbridge','Fictional','Fictional','Undersecretary',
  'Will destroy you with a form and a small polite cough.',
  ['cunning','technocrat','paranoid'],'operator',(4,10,1,8,7,6)),
 ('cthulhu','Cthulhu','Fictional','Fictional','Sleeper',
  'Attending the meeting would end the meeting, and the attendees.',
  ['isolationist','warhawk','paranoid'],'titan',(4,7,2,10,9,10)),
 ('jar-jar','Jar Jar Binks','Fictional','Fictional','Junior Representative',
  'Was handed emergency powers once. Everyone agreed not to discuss it.',
  ['liability','loyalist','beloved'],'liability',(4,1,7,4,2,2)),
 ('sonic','Sonic the Hedgehog','Fictional','Fictional','Freedom Fighter',
  'Fast. Will be somewhere else before the consequences arrive.',
  ['soldier','showman','beloved'],'flawed',(7,4,7,8,4,7)),
 ('crewmate','A Crewmate','Fictional','Fictional','Ship Crew',
  'Was in electrical. Says he was in electrical.',
  ['paranoid','loyalist','liability'],'liability',(4,7,4,5,4,5)),
 ('minecraft-steve','Steve','Fictional','Fictional','Builder',
  'Silent, tireless, and has already mined under the palace.',
  ['technocrat','soldier','loyalist'],'operator',(2,5,7,10,7,7)),
 ('elon-musk','Elon Musk','United States','Modern','Chief Executive',
  'Will announce the solution on Friday and the delay on Monday.',
  ['showman','technocrat','scandal-magnet'],'flawed',(7,7,2,7,8,5)),
 ('oprah','Oprah Winfrey','United States','Modern','Broadcaster',
  'Can get a confession out of anyone in under four minutes.',
  ['showman','dealmaker','beloved'],'heavyweight',(10,8,7,8,7,3)),
 ('the-rock','Dwayne Johnson','United States','Modern','Actor',
  'Polls better than every elected official in the building.',
  ['beloved','showman','soldier'],'operator',(9,4,8,8,5,8)),
 ('snoop-dogg','Snoop Dogg','United States','Modern','Rapper, Entrepreneur',
  'Gets on with absolutely everyone, including the opposition.',
  ['beloved','dealmaker','showman'],'operator',(9,7,7,6,6,2)),
 ('attenborough','David Attenborough','United Kingdom','Modern','Broadcaster',
  'Could narrate the collapse of your government and make it beautiful.',
  ['beloved','statesman','technocrat'],'heavyweight',(9,4,10,8,9,2)),
 ('steve-irwin','Steve Irwin','Australia','1990s','Conservationist',
  'Will put his hand in it to find out what it is.',
  ['beloved','soldier','showman'],'operator',(9,3,9,9,5,6)),
 ('mister-rogers','Fred Rogers','United States','1970s','Broadcaster, Minister',
  'Testified to the Senate for six minutes and won.',
  ['beloved','statesman','loyalist'],'heavyweight',(9,5,10,8,8,1)),
 ('julia-child','Julia Child','United States','1960s','Chef, former OSS',
  'Worked in intelligence before the cooking, which explains a great deal.',
  ['technocrat','showman','soldier'],'operator',(8,7,8,8,7,4)),
 ('tesla','Nikola Tesla','Serbia','1900s','Inventor',
  'Has solved the energy crisis and lost the paperwork to a pigeon.',
  ['technocrat','paranoid','strategist'],'flawed',(5,4,8,7,10,4)),
 ('einstein','Albert Einstein','Germany','1930s','Physicist',
  'Can explain why the plan fails, in a way nobody in the room enjoys.',
  ['technocrat','statesman','beloved'],'heavyweight',(7,4,9,7,10,3)),
 ('ada-lovelace','Ada Lovelace','United Kingdom','1840s','Mathematician',
  'Wrote the programme a century before anyone built the machine.',
  ['technocrat','strategist','banker'],'operator',(5,7,8,7,10,2)),
 ('marie-curie','Marie Curie','Poland','1900s','Physicist',
  'Carried the research in her pockets, which is why she is not with us.',
  ['technocrat','loyalist','statesman'],'heavyweight',(5,5,10,10,10,3)),
 ('turing','Alan Turing','United Kingdom','1940s','Cryptanalyst',
  'Broke the unbreakable and was thanked appallingly.',
  ['technocrat','strategist','loyalist'],'heavyweight',(4,9,9,8,10,4)),
 ('jane-goodall','Jane Goodall','United Kingdom','Modern','Primatologist',
  'Has spent sixty years observing troop hierarchies. Recognises this one.',
  ['statesman','beloved','technocrat'],'operator',(7,6,10,9,8,2)),
 ('danny-devito','Danny DeVito','United States','Modern','Actor',
  'Will absolutely take the meeting and absolutely cause a scene.',
  ['showman','dealmaker','beloved'],'flawed',(8,7,5,7,6,5)),
 ('nicolas-cage','Nicolas Cage','United States','Modern','Actor',
  'Committed. Unpredictably, enormously committed.',
  ['showman','soldier','liability'],'flawed',(8,3,6,8,4,8)),
 ('herzog','Werner Herzog','Germany','Modern','Director',
  'Regards the crisis as confirmation of everything he has always said.',
  ['statesman','strategist','isolationist'],'operator',(6,7,7,10,9,4)),
 ('weird-al','"Weird Al" Yankovic','United States','Modern','Musician',
  'Can turn the opposition slogan into something nobody can say seriously again.',
  ['showman','beloved','demagogue'],'operator',(9,7,8,7,7,2)),
 ('bear-grylls','Bear Grylls','United Kingdom','Modern','Survivalist',
  'Has a plan for the collapse and is mildly excited about it.',
  ['soldier','showman','strategist'],'operator',(7,5,7,10,6,8)),
 ('clarkson','Jeremy Clarkson','United Kingdom','Modern','Broadcaster',
  'Will describe the crisis using an inappropriate car metaphor, at length.',
  ['demagogue','showman','scandal-magnet'],'flawed',(8,5,3,6,5,7)),
 ('judge-judy','Judge Judy','United States','Modern','Judge',
  'Thirty seconds per case and no interest at all in your explanation.',
  ['statesman','soldier','technocrat'],'heavyweight',(8,7,9,9,8,8)),
 ('simon-cowell','Simon Cowell','United Kingdom','Modern','Producer',
  'Will tell the delegation exactly what he thinks of their proposal.',
  ['demagogue','cunning','showman'],'operator',(7,9,4,6,7,6)),
]
for w in W:
    add(w[0],w[1],w[2],w[3],w[4],w[5],w[6],w[7],NEU,WILD,w[8])

for w in [
 ('colonel-sanders','Colonel Sanders','United States','1950s','Restaurateur',
  'Not a real colonel. Has never let that slow him down.',
  ['showman','dealmaker','banker'],'operator',(8,7,5,7,6,3)),
 ('gritty','Gritty','United States','Modern','Mascot',
  'Nobody knows what he is. Nobody is willing to say it to his face.',
  ['showman','demagogue','soldier'],'flawed',(8,5,5,7,2,8)),
]:
    add(w[0],w[1],w[2],w[3],w[4],w[5],w[6],w[7],NEU,WILD,w[8])

# ----------------------------------------------------------------- objects
for o in [
 ('chunghwa-cigs','A Pack of Chunghwa Cigarettes','China','Modern','Ceremonial Gift',
  'Opens more doors in this building than any minister on this list.',
  ['dealmaker','banker','loyalist'],'flawed',(7,9,3,5,4,2)),
 ('red-telephone','The Red Telephone','Fictional','1960s','Direct Line',
  'Only rings for one reason and everyone in the room knows it.',
  ['statesman','strategist','paranoid'],'operator',(5,7,8,8,7,7)),
 ('rubber-stamp','A Rubber Stamp','Fictional','Modern','Office Equipment',
  'Approves everything. Has never once read anything.',
  ['loyalist','technocrat','liability'],'liability',(2,4,3,8,2,3)),
 ('filing-cabinet','A Locked Filing Cabinet','Fictional','Modern','Records',
  'Contains everything anyone has ever done. The key is missing.',
  ['paranoid','technocrat','banker'],'liability',(1,9,5,8,6,3)),
 ('traffic-cone','A Traffic Cone','Fictional','Modern','Street Furniture',
  'Provides direction. Provides nothing else.',
  ['loyalist','liability','soldier'],'liability',(3,1,8,7,1,4)),
 ('roomba','A Roomba','Fictional','Modern','Automated Staff',
  'Works tirelessly, learns the floor plan, cannot handle stairs or nuance.',
  ['technocrat','loyalist','liability'],'liability',(2,3,7,9,5,2)),
 ('fax-machine','A Fax Machine','Fictional','1980s','Communications',
  'Still the official channel. Nobody remembers why.',
  ['technocrat','isolationist','liability'],'liability',(1,4,6,9,4,2)),
 ('potted-fern','A Potted Fern','Fictional','Modern','Décor',
  'Present at every meeting for eleven years. Has heard everything.',
  ['loyalist','paranoid','liability'],'liability',(3,7,7,7,2,1)),
 ('shredder','A Paper Shredder','Fictional','Modern','Records Management',
  'The most reliable member of any administration.',
  ['cunning','loyalist','scandal-magnet'],'flawed',(2,10,1,8,4,6)),
 ('briefcase-of-cash','A Briefcase of Unmarked Cash','Fictional','Modern','Discretionary Fund',
  'Persuades absolutely anyone and explains absolutely nothing.',
  ['banker','dealmaker','scandal-magnet'],'operator',(8,10,1,5,5,4)),
 ('nuclear-football','The Nuclear Football','United States','Modern','Emergency Satchel',
  'Follows the President everywhere and settles every argument permanently.',
  ['warhawk','soldier','paranoid'],'operator',(3,4,4,9,5,10)),
 ('half-sandwich','A Half-Eaten Sandwich','Fictional','Modern','Left on the Table',
  'Has been in the situation room since Tuesday and is now part of the team.',
  ['liability','loyalist','beloved'],'liability',(4,1,6,8,1,2)),
]:
    add(o[0],o[1],o[2],o[3],o[4],o[5],o[6],o[7],NEU,OBJ,o[8])
