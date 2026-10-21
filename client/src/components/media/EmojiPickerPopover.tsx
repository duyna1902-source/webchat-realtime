import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search } from 'lucide-react';

export interface EmojiItem {
  emoji: string;
  name: string;
  keywords: string[];
}

export interface EmojiCategory {
  id: string;
  name: string;
  icon: string;
  emojis: EmojiItem[];
}

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'smileys',
    name: 'Smileys & Emotion',
    icon: '😀',
    emojis: [
      { emoji: '😀', name: 'Grinning Face', keywords: ['smile', 'happy', 'grin'] },
      { emoji: '😃', name: 'Grinning Face with Big Eyes', keywords: ['smile', 'happy', 'joy'] },
      { emoji: '😄', name: 'Grinning Face with Smiling Eyes', keywords: ['laugh', 'happy', 'smile'] },
      { emoji: '😁', name: 'Beaming Face with Smiling Eyes', keywords: ['grin', 'smile'] },
      { emoji: '😆', name: 'Grinning Squinting Face', keywords: ['laugh', 'haha', 'lol'] },
      { emoji: '😅', name: 'Grinning Face with Sweat', keywords: ['hot', 'nervous', 'relief'] },
      { emoji: '🤣', name: 'Rolling on the Floor Laughing', keywords: ['rofl', 'laugh', 'lol', 'funny'] },
      { emoji: '😂', name: 'Face with Tears of Joy', keywords: ['cry', 'laugh', 'lol', 'funny'] },
      { emoji: '🙂', name: 'Slightly Smiling Face', keywords: ['smile', 'fine'] },
      { emoji: '🙃', name: 'Upside-Down Face', keywords: ['silly', 'sarcasm', 'irony'] },
      { emoji: '😉', name: 'Winking Face', keywords: ['wink', 'flirt'] },
      { emoji: '😊', name: 'Smiling Face with Smiling Eyes', keywords: ['blush', 'proud', 'warm'] },
      { emoji: '😇', name: 'Smiling Face with Halo', keywords: ['angel', 'innocent', 'good'] },
      { emoji: '🥰', name: 'Smiling Face with Hearts', keywords: ['love', 'crush', 'adore'] },
      { emoji: '😍', name: 'Heart-Eyes', keywords: ['love', 'crush', 'heart'] },
      { emoji: '🤩', name: 'Star-Struck', keywords: ['excited', 'star', 'wow'] },
      { emoji: '😘', name: 'Face Blowing a Kiss', keywords: ['kiss', 'love'] },
      { emoji: '😋', name: 'Face Savoring Food', keywords: ['yummy', 'delicious', 'food'] },
      { emoji: '😛', name: 'Face with Tongue', keywords: ['tongue', 'playful'] },
      { emoji: '😜', name: 'Winking Face with Tongue', keywords: ['prank', 'joke', 'wink'] },
      { emoji: '🤪', name: 'Zany Face', keywords: ['crazy', 'wild', 'goofy'] },
      { emoji: '😝', name: 'Squinting Face with Tongue', keywords: ['tongue', 'silly'] },
      { emoji: '🤑', name: 'Money-Mouth Face', keywords: ['rich', 'money', 'dollar'] },
      { emoji: '🤗', name: 'Smiling Face with Open Hands', keywords: ['hug', 'warm'] },
      { emoji: '🤭', name: 'Face with Hand Over Mouth', keywords: ['oops', 'giggle', 'secret'] },
      { emoji: '🤫', name: 'Shushing Face', keywords: ['quiet', 'shh', 'silence'] },
      { emoji: '🤔', name: 'Thinking Face', keywords: ['think', 'hmm', 'ponder'] },
      { emoji: '🤐', name: 'Zipper-Mouth Face', keywords: ['quiet', 'zip', 'secret'] },
      { emoji: '🤨', name: 'Face with Raised Eyebrow', keywords: ['skeptic', 'suspicious'] },
      { emoji: '😐', name: 'Neutral Face', keywords: ['meh', 'neutral'] },
      { emoji: '😑', name: 'Expressionless Face', keywords: ['blank', 'unmoved'] },
      { emoji: '😶', name: 'Face Without Mouth', keywords: ['speechless', 'silent'] },
      { emoji: '😏', name: 'Smirking Face', keywords: ['smirk', 'cool', 'flirt'] },
      { emoji: '😒', name: 'Unamused Face', keywords: ['bored', 'unamused'] },
      { emoji: '🙄', name: 'Face with Rolling Eyes', keywords: ['eyeroll', 'annoyed'] },
      { emoji: '😬', name: 'Grimacing Face', keywords: ['awkward', 'cringe'] },
      { emoji: '🤥', name: 'Lying Face', keywords: ['lie', 'pinocchio'] },
      { emoji: '😌', name: 'Relieved Face', keywords: ['peace', 'relief', 'calm'] },
      { emoji: '😔', name: 'Pensive Face', keywords: ['sad', 'lonely', 'pensive'] },
      { emoji: '😪', name: 'Sleepy Face', keywords: ['tired', 'sleepy'] },
      { emoji: '🤤', name: 'Drooling Face', keywords: ['drool', 'craving'] },
      { emoji: '😴', name: 'Sleeping Face', keywords: ['sleep', 'zzz', 'night'] },
      { emoji: '😷', name: 'Face with Medical Mask', keywords: ['mask', 'sick', 'virus'] },
      { emoji: '🤒', name: 'Face with Thermometer', keywords: ['sick', 'fever'] },
      { emoji: '🤕', name: 'Face with Head-Bandage', keywords: ['hurt', 'injury'] },
      { emoji: '🤢', name: 'Nauseated Face', keywords: ['sick', 'gross'] },
      { emoji: '🤮', name: 'Face Vomiting', keywords: ['puke', 'vomit'] },
      { emoji: '🥵', name: 'Hot Face', keywords: ['hot', 'heat', 'sweat'] },
      { emoji: '🥶', name: 'Cold Face', keywords: ['cold', 'freezing', 'ice'] },
      { emoji: '🥴', name: 'Woozy Face', keywords: ['dizzy', 'drunk'] },
      { emoji: '😵', name: 'Crossed-Out Eyes', keywords: ['dead', 'dizzy'] },
      { emoji: '🤯', name: 'Exploding Head', keywords: ['mind blown', 'shock', 'boom'] },
      { emoji: '🥳', name: 'Partying Face', keywords: ['party', 'celebrate', 'hat'] },
      { emoji: '😎', name: 'Smiling Face with Sunglasses', keywords: ['cool', 'sunglasses'] },
      { emoji: '🤓', name: 'Nerd Face', keywords: ['nerd', 'geek', 'glasses'] },
      { emoji: '🧐', name: 'Face with Monocle', keywords: ['classy', 'inspect', 'hmm'] },
      { emoji: '😕', name: 'Confused Face', keywords: ['confused', 'puzzled'] },
      { emoji: '😟', name: 'Worried Face', keywords: ['worry', 'anxious'] },
      { emoji: '😮', name: 'Face with Open Mouth', keywords: ['wow', 'surprise'] },
      { emoji: '😲', name: 'Astonished Face', keywords: ['shock', 'amazed'] },
      { emoji: '🥺', name: 'Pleading Face', keywords: ['please', 'puppy eyes', 'beg'] },
      { emoji: '😢', name: 'Crying Face', keywords: ['tear', 'sad', 'cry'] },
      { emoji: '😭', name: 'Loudly Crying Face', keywords: ['sob', 'cry', 'sad'] },
      { emoji: '😱', name: 'Face Screaming in Fear', keywords: ['scream', 'scared', 'fear'] },
      { emoji: '😡', name: 'Pouting Face', keywords: ['angry', 'mad', 'red'] },
      { emoji: '😠', name: 'Angry Face', keywords: ['angry', 'annoyed'] },
      { emoji: '🤬', name: 'Face with Symbols on Mouth', keywords: ['curse', 'swear', 'mad'] },
      { emoji: '😈', name: 'Smiling Face with Horns', keywords: ['devil', 'evil', 'horns'] },
      { emoji: '💀', name: 'Skull', keywords: ['dead', 'skeleton', 'skull', 'lol'] },
      { emoji: '💩', name: 'Pile of Poo', keywords: ['poop', 'poo', 'funny'] },
      { emoji: '🤡', name: 'Clown Face', keywords: ['clown', 'circus', 'fool'] },
      { emoji: '👻', name: 'Ghost', keywords: ['ghost', 'spooky', 'boo'] },
      { emoji: '❤️', name: 'Red Heart', keywords: ['love', 'heart'] },
      { emoji: '🔥', name: 'Fire', keywords: ['hot', 'lit', 'fire'] },
      { emoji: '✨', name: 'Sparkles', keywords: ['shine', 'magic', 'stars'] },
      { emoji: '💯', name: 'Hundred Points', keywords: ['100', 'perfect', 'score'] },
    ],
  },
  {
    id: 'gestures',
    name: 'People & Gestures',
    icon: '👋',
    emojis: [
      { emoji: '👋', name: 'Waving Hand', keywords: ['wave', 'hello', 'bye', 'hi'] },
      { emoji: '✋', name: 'Raised Hand', keywords: ['hand', 'stop', 'high five'] },
      { emoji: '👌', name: 'OK Hand', keywords: ['ok', 'perfect', 'agree'] },
      { emoji: '🤌', name: 'Pinched Fingers', keywords: ['italian', 'hand', 'what'] },
      { emoji: '✌️', name: 'Victory Hand', keywords: ['peace', 'victory', 'two'] },
      { emoji: '🤞', name: 'Crossed Fingers', keywords: ['luck', 'hope', 'fingers'] },
      { emoji: '🤟', name: 'Love-You Gesture', keywords: ['love', 'ily', 'hand'] },
      { emoji: '🤘', name: 'Sign of the Horns', keywords: ['rock', 'horns', 'metal'] },
      { emoji: '🤙', name: 'Call Me Hand', keywords: ['call', 'phone', 'hang loose'] },
      { emoji: '👈', name: 'Pointing Left', keywords: ['point', 'left', 'finger'] },
      { emoji: '👉', name: 'Pointing Right', keywords: ['point', 'right', 'finger'] },
      { emoji: '👆', name: 'Pointing Up', keywords: ['point', 'up', 'finger'] },
      { emoji: '👇', name: 'Pointing Down', keywords: ['point', 'down', 'finger'] },
      { emoji: '👍', name: 'Thumbs Up', keywords: ['thumbs up', 'yes', 'good', 'agree', 'like'] },
      { emoji: '👎', name: 'Thumbs Down', keywords: ['thumbs down', 'no', 'dislike', 'bad'] },
      { emoji: '✊', name: 'Raised Fist', keywords: ['fist', 'power'] },
      { emoji: '👊', name: 'Oncoming Fist', keywords: ['punch', 'bro fist'] },
      { emoji: '👏', name: 'Clapping Hands', keywords: ['clap', 'applause', 'bravo'] },
      { emoji: '🙌', name: 'Raising Hands', keywords: ['hooray', 'celebrate', 'praise'] },
      { emoji: '🤝', name: 'Handshake', keywords: ['shake', 'deal', 'agreement'] },
      { emoji: '🙏', name: 'Folded Hands', keywords: ['please', 'thank you', 'pray', 'thanks'] },
      { emoji: '💪', name: 'Flexed Biceps', keywords: ['muscle', 'strong', 'flex'] },
      { emoji: '👍🏽', name: 'Thumbs Up Medium Skin Tone', keywords: ['thumbs up', 'like'] },
      { emoji: '👨‍👩‍👧‍👦', name: 'Family', keywords: ['family', 'group', 'parents', 'children'] },
      { emoji: '🧠', name: 'Brain', keywords: ['brain', 'smart', 'think'] },
      { emoji: '👀', name: 'Eyes', keywords: ['eyes', 'look', 'see'] },
    ],
  },
  {
    id: 'animals',
    name: 'Animals & Nature',
    icon: '🐶',
    emojis: [
      { emoji: '🐶', name: 'Dog Face', keywords: ['dog', 'puppy', 'pet'] },
      { emoji: '🐱', name: 'Cat Face', keywords: ['cat', 'kitten', 'pet'] },
      { emoji: '🐭', name: 'Mouse Face', keywords: ['mouse'] },
      { emoji: '🐹', name: 'Hamster Face', keywords: ['hamster'] },
      { emoji: '🐰', name: 'Rabbit Face', keywords: ['bunny', 'rabbit'] },
      { emoji: '🦊', name: 'Fox Face', keywords: ['fox'] },
      { emoji: '🐻', name: 'Bear Face', keywords: ['bear'] },
      { emoji: '🐼', name: 'Panda Face', keywords: ['panda'] },
      { emoji: '🐨', name: 'Koala', keywords: ['koala'] },
      { emoji: '🐯', name: 'Tiger Face', keywords: ['tiger'] },
      { emoji: '🦁', name: 'Lion Face', keywords: ['lion'] },
      { emoji: '🐮', name: 'Cow Face', keywords: ['cow'] },
      { emoji: '🐷', name: 'Pig Face', keywords: ['pig'] },
      { emoji: '🐸', name: 'Frog Face', keywords: ['frog'] },
      { emoji: '🐵', name: 'Monkey Face', keywords: ['monkey'] },
      { emoji: '🐔', name: 'Chicken', keywords: ['chicken', 'hen'] },
      { emoji: '🐧', name: 'Penguin', keywords: ['penguin'] },
      { emoji: '🐦', name: 'Bird', keywords: ['bird'] },
      { emoji: '🦄', name: 'Unicorn', keywords: ['unicorn', 'magic'] },
      { emoji: '🐝', name: 'Honeybee', keywords: ['bee', 'honey'] },
      { emoji: '🦋', name: 'Butterfly', keywords: ['butterfly'] },
      { emoji: '🌸', name: 'Cherry Blossom', keywords: ['flower', 'blossom'] },
      { emoji: '🌹', name: 'Rose', keywords: ['flower', 'rose'] },
      { emoji: '🌻', name: 'Sunflower', keywords: ['flower', 'sunflower'] },
      { emoji: '🍀', name: 'Four Leaf Clover', keywords: ['clover', 'luck'] },
    ],
  },
  {
    id: 'food',
    name: 'Food & Drink',
    icon: '🍕',
    emojis: [
      { emoji: '🍎', name: 'Red Apple', keywords: ['apple', 'fruit'] },
      { emoji: '🍌', name: 'Banana', keywords: ['banana', 'fruit'] },
      { emoji: '🍉', name: 'Watermelon', keywords: ['melon', 'fruit'] },
      { emoji: '🍓', name: 'Strawberry', keywords: ['berry', 'fruit'] },
      { emoji: '🥑', name: 'Avocado', keywords: ['avocado'] },
      { emoji: '🍕', name: 'Pizza', keywords: ['pizza', 'cheese'] },
      { emoji: '🍔', name: 'Hamburger', keywords: ['burger', 'food'] },
      { emoji: '🍟', name: 'French Fries', keywords: ['fries', 'chips'] },
      { emoji: '🌭', name: 'Hot Dog', keywords: ['hot dog'] },
      { emoji: '🌮', name: 'Taco', keywords: ['taco', 'mexican'] },
      { emoji: '🍣', name: 'Sushi', keywords: ['sushi', 'fish'] },
      { emoji: '🍜', name: 'Steaming Bowl', keywords: ['ramen', 'noodles', 'soup'] },
      { emoji: '🍦', name: 'Soft Ice Cream', keywords: ['ice cream'] },
      { emoji: '🎂', name: 'Birthday Cake', keywords: ['cake', 'birthday'] },
      { emoji: '🍿', name: 'Popcorn', keywords: ['popcorn', 'snack'] },
      { emoji: '🍩', name: 'Doughnut', keywords: ['donut', 'doughnut'] },
      { emoji: '☕', name: 'Hot Beverage', keywords: ['coffee', 'tea'] },
      { emoji: '🧋', name: 'Bubble Tea', keywords: ['boba', 'tea'] },
      { emoji: '🍺', name: 'Beer Mug', keywords: ['beer', 'drink'] },
      { emoji: '🍻', name: 'Clinking Beer Mugs', keywords: ['cheers', 'beer'] },
      { emoji: '🥂', name: 'Clinking Glasses', keywords: ['toast', 'champagne'] },
    ],
  },
  {
    id: 'objects',
    name: 'Activities & Objects',
    icon: '🎉',
    emojis: [
      { emoji: '🎉', name: 'Party Popper', keywords: ['party', 'celebrate', 'congrats'] },
      { emoji: '🎊', name: 'Confetti Ball', keywords: ['confetti', 'party'] },
      { emoji: '🎈', name: 'Balloon', keywords: ['balloon', 'celebration'] },
      { emoji: '🎁', name: 'Wrapped Gift', keywords: ['gift', 'present'] },
      { emoji: '🏆', name: 'Trophy', keywords: ['trophy', 'winner', 'cup'] },
      { emoji: '🥇', name: '1st Place Medal', keywords: ['gold', 'first', 'winner'] },
      { emoji: '⚽', name: 'Soccer Ball', keywords: ['soccer', 'football'] },
      { emoji: '🏀', name: 'Basketball', keywords: ['basketball'] },
      { emoji: '🎮', name: 'Video Game', keywords: ['game', 'gaming', 'controller'] },
      { emoji: '💻', name: 'Laptop', keywords: ['computer', 'laptop', 'work'] },
      { emoji: '📱', name: 'Mobile Phone', keywords: ['phone', 'mobile'] },
      { emoji: '💡', name: 'Light Bulb', keywords: ['idea', 'light'] },
      { emoji: '🚀', name: 'Rocket', keywords: ['rocket', 'launch', 'fast'] },
      { emoji: '⭐', name: 'Star', keywords: ['star', 'shine'] },
    ],
  },
];

interface EmojiPickerPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
}

export const EmojiPickerPopover: React.FC<EmojiPickerPopoverProps> = ({
  isOpen,
  onClose,
  onSelectEmoji,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('smileys');
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setActiveCategory('smileys');
    }
  }, [isOpen]);

  const filteredEmojis = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;

    const allEmojis = EMOJI_CATEGORIES.flatMap((c) => c.emojis);
    return allEmojis.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.keywords.some((k) => k.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Emoji Picker"
      className="absolute bottom-full mb-2 left-0 z-50 w-72 sm:w-80 max-w-[calc(100vw-1.5rem)] bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden flex flex-col text-gray-900 animate-in fade-in zoom-in-95 duration-100"
    >
      {/* Search Input Bar */}
      <div className="p-2.5 border-b border-gray-100 bg-gray-50/50">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-gray-400 absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search emojis..."
            className="w-full bg-white border border-gray-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-google-blue transition"
            autoFocus
          />
        </div>
      </div>

      {/* Category Icons Bar (hidden when searching) */}
      {!searchQuery && (
        <div className="flex items-center justify-around px-2 py-1.5 border-b border-gray-100 bg-white">
          {EMOJI_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`p-1.5 rounded-lg text-sm transition cursor-pointer ${
                activeCategory === cat.id
                  ? 'bg-google-blue-subtle text-google-blue scale-110 shadow-xs'
                  : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
              }`}
              title={cat.name}
              aria-label={cat.name}
            >
              {cat.icon}
            </button>
          ))}
        </div>
      )}

      {/* Emoji Grid */}
      <div className="p-2 max-h-56 overflow-y-auto overflow-x-hidden">
        {filteredEmojis ? (
          <div>
            <div className="text-[11px] font-semibold text-gray-400 px-1 mb-1">
              Search Results ({filteredEmojis.length})
            </div>
            {filteredEmojis.length === 0 ? (
              <div className="text-center text-xs text-gray-400 py-6">
                No emojis found for "{searchQuery}"
              </div>
            ) : (
              <div className="grid grid-cols-7 sm:grid-cols-8 gap-1">
                {filteredEmojis.map((item, idx) => (
                  <button
                    key={`${item.emoji}-${idx}`}
                    type="button"
                    onClick={() => {
                      onSelectEmoji(item.emoji);
                    }}
                    title={item.name}
                    aria-label={item.name}
                    className="w-8 h-8 flex items-center justify-center text-lg rounded-lg hover:bg-google-blue-subtle hover:scale-115 active:scale-95 transition cursor-pointer font-sans"
                  >
                    {item.emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            {EMOJI_CATEGORIES.filter((c) => c.id === activeCategory).map((cat) => (
              <div key={cat.id}>
                <div className="text-[11px] font-semibold text-gray-400 px-1 mb-1">
                  {cat.name}
                </div>
                <div className="grid grid-cols-7 sm:grid-cols-8 gap-1">
                  {cat.emojis.map((item, idx) => (
                    <button
                      key={`${item.emoji}-${idx}`}
                      type="button"
                      onClick={() => {
                        onSelectEmoji(item.emoji);
                      }}
                      title={item.name}
                      aria-label={item.name}
                      className="w-8 h-8 flex items-center justify-center text-lg rounded-lg hover:bg-google-blue-subtle hover:scale-115 active:scale-95 transition cursor-pointer font-sans"
                    >
                      {item.emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
