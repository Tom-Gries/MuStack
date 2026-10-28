import React from 'react';

const C = {
  ink: '#334c39',
  cream: '#f5efd9',
  pale: '#e7dfbd',
  green: '#708858',
  lightGreen: '#91a36b',
  darkGreen: '#486644',
  terra: '#c77a55',
  lightTerra: '#e2a179',
  bark: '#947050',
  wood: '#be9969',
  gold: '#d9ad52',
  lightGold: '#f0cf7d',
  stone: '#a0a69a',
  darkStone: '#6e7c73',
  red: '#b95645',
};

function Shadow({ x = 60, y = 88, rx = 39, ry = 5 }) {
  return <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={C.ink} opacity=".1" stroke="none" />;
}

function Leaf({ x, y, rotate = 0, fill = C.green, scale = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
      <path d="M0 0C-1-10 5-18 16-19 17-8 10-1 0 0Z" fill={fill} />
      <path d="M1-1 10-12" fill="none" strokeWidth="1.3" />
    </g>
  );
}

function Berry({ x = 0, y = 0, scale = 1, rotate = 0 }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
      <path d="M-12 0C-16 5-10 17 0 22 10 17 16 5 12 0 7-6-7-6-12 0Z" fill={C.red} />
      <path d="m-11-2 7-4 4 4 4-4 7 4-7 4-4-3-4 3Z" fill={C.green} />
      <path d="M0-3 2-9" fill="none" />
      <path d="m-7 5 1 1m12-1-1 1M0 8v1m-4 4 1 1m7-1-1 1" stroke={C.lightGold} strokeWidth="1.8" />
    </g>
  );
}

function Coin({ x = 0, y = 0, scale = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cy="3" rx="15" ry="7" fill={C.gold} />
      <ellipse rx="15" ry="7" fill={C.lightGold} />
      <ellipse rx="9" ry="3.5" fill="none" stroke={C.gold} strokeWidth="1.8" />
      <path d="M-10 5v2M0 7v3m10-5v2" strokeWidth="1.2" />
    </g>
  );
}

function Log({ x = 0, y = 0, rotate = 0, scale = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
      <path d="M-27-10 12-15C22-16 29-8 29 1S23 16 14 16l-39-5Z" fill={C.bark} />
      <path d="m-18-5 31-5M-14 3l29-2M-15 8l22 1" opacity=".65" fill="none" strokeWidth="1.4" />
      <ellipse cx="-25" cy="0" rx="12" ry="12" fill={C.pale} />
      <ellipse cx="-25" cy="0" rx="7" ry="7" fill="none" stroke={C.bark} strokeWidth="1.5" />
      <path d="M-27-2c5-3 7 3 2 4m-9-10 5 5m-6 9 5-2" fill="none" stroke={C.bark} strokeWidth="1.3" />
    </g>
  );
}

function Grass({ x = 0, y = 0, scale = 1 }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${scale})`}
      d="m-7 0 2-8 4 7L1-12 4-1l5-5-2 6"
      fill={C.green}
      strokeWidth="1.5"
    />
  );
}

function Person({ corpse = false }) {
  if (corpse) {
    return (
      <>
        <Shadow y={86} rx={43} />
        <path d="m46 68 42 2 16 8-3 6-21-6-36 3Z" fill={C.darkGreen} />
        <path d="m62 71 19 6 17 7-3 5-19-5-20-5" fill={C.green} />
        <path d="M47 62c10-1 19 7 19 18l-20 3-12-10Z" fill={C.terra} />
        <path d="m50 65 15 7-2 5-16-7" fill={C.lightTerra} />
        <path d="M18 70c-1-10 7-17 16-15 8 1 12 9 8 16-4 9-20 10-24-1Z" fill={C.pale} />
        <path d="M17 66c-1-9 5-15 14-14l9 6-12 1-5 8Z" fill={C.bark} />
        <path d="m25 65 4 4m0-4-4 4m10-5 4 4m0-4-4 4" strokeWidth="1.4" />
        <path d="m89 78 11 2 4 5-4 3-9-5m6-6 7 1 6 5-4 3-7-4" fill={C.bark} />
        <Leaf x={18} y={90} rotate={-40} scale={.55} />
      </>
    );
  }
  return (
    <>
      <Shadow rx={31} />
      <path d="m46 67-4 20h12l6-18 5 18h12l-5-23Z" fill={C.darkGreen} />
      <path d="m41 84-3 7h18v-6m9-1v7h18l-8-7" fill={C.bark} />
      <path d="M41 43c-8 4-13 16-13 27l8 3 8-19m29-10c7 3 11 10 14 21l-8 4-10-17" fill={C.green} />
      <path d="M42 42c9-6 23-6 31 2l3 24c-11 8-25 8-38 0Z" fill={C.green} />
      <path d="m43 44 14 14 15-14m-14 6v20" fill="none" stroke={C.darkGreen} />
      <path d="M40 64h34l1 6H39Z" fill={C.bark} />
      <rect x="55" y="64" width="8" height="7" rx="1.5" fill={C.gold} />
      <path d="M43 24c0-12 29-14 30 1l-2 11c-3 9-23 10-27-1Z" fill={C.pale} />
      <path d="M43 29c-7-18 9-23 19-20 11-3 18 9 12 20l-5-8c-10 4-14 1-18-2l-4 10Z" fill={C.bark} />
      <path d="M51 29v2m14-2v2m-10 5c3 2 5 2 8-1" fill="none" strokeWidth="1.7" />
      <path d="m32 65-5 5c-3 5 3 9 6 6l4-8m45-4 5 3c6 1 7 7 3 9-3 2-7-1-9-7" fill={C.pale} />
      <path d="m77 53 7 4-3 18-12-3Z" fill={C.terra} />
      <path d="M73 56c0-10 11-15 14-3" fill="none" />
      <Leaf x={83} y={53} rotate={-30} scale={.45} />
    </>
  );
}

function Tree() {
  return (
    <>
      <Shadow rx={36} />
      <path d="M53 46h15l-1 34 11 8H43l11-9Z" fill={C.bark} />
      <path d="m60 57-1 23m5-9 8 9m-16-9-6 10" fill="none" strokeWidth="1.6" />
      <path d="M28 58C11 52 18 30 33 28c-5-19 24-28 35-15 17-6 32 7 29 21 15 11 8 29-5 31-4 12-27 13-34 3-10 10-29 3-30-10Z" fill={C.green} />
      <path d="M22 45c7-7 14-5 17-3m9-23c6-2 12 0 15 4m17 4c7 2 10 6 9 11M43 61c7 1 14-2 17-7m16 3c7 2 14-1 17-5" fill="none" stroke={C.darkGreen} strokeWidth="1.8" />
      <path d="M31 29c5-9 12-10 17-8m-23 15 7-2m43-13 6 2" fill="none" stroke={C.lightGreen} strokeWidth="4" />
      <Grass x={34} y={88} scale={.65} />
      <Grass x={85} y={88} scale={.65} />
    </>
  );
}

function Rock() {
  return (
    <>
      <Shadow rx={43} />
      <path d="m17 75 9-29 18-5 8-19 27 6 16 22 11 28-25 10H39Z" fill={C.stone} />
      <path d="m26 46 22 14 4-38m-4 38 29-13 2-19m-2 19 18 3M48 60l-9 28m38-41 4 41m-33-28 33 28" fill="none" stroke={C.darkStone} strokeWidth="1.8" />
      <path d="m52 27 19 4-16 16-4 7Zm29 8 8 14-8-1" fill={C.cream} opacity=".32" stroke="none" />
      <path d="m25 72 10-16m55 8 5 12" fill="none" stroke={C.cream} strokeWidth="2.4" opacity=".45" />
      <Grass x={16} y={86} scale={.7} />
      <path d="m91 85 7-6 10 6-4 4H94Z" fill={C.darkStone} />
    </>
  );
}

function BerryBush() {
  return (
    <>
      <Shadow rx={42} />
      <path d="m58 64-6 23h16l-5-23" fill={C.bark} />
      <path d="M25 76C5 67 16 45 30 45c-4-20 20-29 31-16 11-17 37-7 34 10 23 3 24 28 6 35-1 14-24 18-36 7-14 12-37 8-40-5Z" fill={C.green} />
      <path d="M29 56c3-6 9-8 14-6m12-11c7-5 13-4 17 0m16 14c9 0 12 3 13 8M43 75c6 3 10 2 14-1m20 0 8-4" fill="none" stroke={C.darkGreen} strokeWidth="1.7" />
      <Berry x={34} y={52} scale={.45} rotate={-15} />
      <Berry x={65} y={38} scale={.5} rotate={14} />
      <Berry x={88} y={59} scale={.5} rotate={-10} />
      <Berry x={56} y={67} scale={.45} rotate={18} />
      <Grass x={24} y={88} scale={.6} />
      <Grass x={93} y={88} scale={.6} />
    </>
  );
}

function Rat() {
  return (
    <>
      <Shadow y={87} rx={43} />
      <path d="M33 74C8 69 6 50 18 49c9-1 12 10 7 13" fill="none" stroke={C.terra} strokeWidth="6" />
      <path d="M30 68c-3-20 12-33 32-29 11 2 21 10 25 23l17 12-6 9-27 1-17-4-18 3Z" fill={C.stone} />
      <path d="M68 49c-13-3-15-21-6-25 10-5 19 12 13 22m6 5c-4-10 5-19 12-14 7 4 1 17-4 18" fill={C.stone} />
      <path d="M67 43c-6-5-8-12-4-14 4-1 9 6 8 11m15 8c-1-5 2-9 5-7 2 2 0 6-2 8" fill={C.lightTerra} stroke="none" />
      <path d="m43 79-3 7h14l2-6m20 0 3 6h14l-7-7" fill={C.darkStone} />
      <path d="m97 72 7 2-4 5-5-3Z" fill={C.terra} />
      <circle cx="85" cy="62" r="3" fill={C.ink} stroke="none" />
      <circle cx="86" cy="61" r=".9" fill={C.cream} stroke="none" />
      <path d="m91 72 12-7m-11 10 16 1m-15 2 10 7M36 60c2-7 7-11 13-12" fill="none" strokeWidth="1.4" />
    </>
  );
}

function Soil({ field = false }) {
  return (
    <>
      <Shadow rx={46} />
      <path d="m14 62 34-27 57 18v20L71 93 14 79Z" fill={C.bark} />
      <path d="m14 62 34-27 57 18-34 26Z" fill={field ? '#836b44' : '#a18757'} />
      <path d="M71 79v14m-57-31 57 17 34-26" fill="none" />
      <path d="m26 61 31 9m-18-20 31 9m-19-19 32 10" fill="none" stroke={C.ink} opacity=".45" strokeWidth="2.3" />
      <path d="m23 73 4 1m17 3 4 1m36 3 3-2m6-9 3-2" fill="none" stroke={C.pale} strokeWidth="2" />
      {field ? (
        <>
          <Leaf x={32} y={56} rotate={-50} scale={.52} />
          <Leaf x={33} y={57} rotate={35} scale={.5} />
          <Berry x={36} y={49} scale={.48} rotate={-10} />
          <Leaf x={57} y={39} rotate={-55} scale={.5} />
          <Leaf x={59} y={42} rotate={35} scale={.5} />
          <Berry x={61} y={34} scale={.48} rotate={12} />
          <Leaf x={76} y={64} rotate={-45} scale={.55} />
          <Leaf x={77} y={64} rotate={38} scale={.55} />
          <Berry x={81} y={55} scale={.5} rotate={10} />
          <Leaf x={91} y={48} rotate={-35} scale={.45} />
        </>
      ) : (
        <>
          <path d="M60 60V34" fill="none" strokeWidth="2.5" />
          <Leaf x={60} y={44} rotate={-85} scale={.85} />
          <Leaf x={60} y={42} rotate={10} scale={.85} fill={C.lightGreen} />
          <path d="m42 63 4-1m34-12 3-1m-27 21 3 1" fill="none" stroke={C.pale} strokeWidth="2" />
        </>
      )}
    </>
  );
}

function Pack() {
  return (
    <>
      <Shadow rx={32} />
      <path d="m33 15 8 3 7-3 8 3 8-3 8 3 8-3 7 3v67l-8 3-8-3-8 3-8-3-8 3-8-3-6 3Z" fill={C.terra} />
      <path d="M38 23h43m-43 56h43" fill="none" stroke={C.lightTerra} strokeWidth="3" />
      <path d="M44 32h32v35H44Z" fill={C.cream} />
      <path d="m60 36-11 15h6l-9 12h28L65 51h6Z" fill={C.green} />
      <path d="M59 58h3v11h-3Z" fill={C.bark} strokeWidth="1.3" />
      <path d="M38 29v44m43-44v44" fill="none" stroke={C.ink} strokeWidth="1" opacity=".35" />
      <path d="m88 31 7-4m-5 13h8M24 36l-6-4" fill="none" stroke={C.gold} strokeWidth="2.4" />
    </>
  );
}

function PiggyBank() {
  return (
    <>
      <Shadow rx={41} />
      <path d="M29 58C16 57 17 43 24 43c7 0 5 10 1 9" fill="none" stroke={C.terra} strokeWidth="3" />
      <path d="M33 43c14-13 40-11 52 3l13 9 6-1v21l-14 1-9 7-2 8H67l-2-7H49l-4 7H34l-2-15c-10-11-10-23 1-33Z" fill={C.lightTerra} />
      <path d="m75 43 3-18 13 12-2 15" fill={C.terra} />
      <path d="m81 37 2-6 5 8" fill={C.lightTerra} strokeWidth="1.3" />
      <path d="M44 44c9-5 16-5 24-1" fill="none" strokeWidth="3.5" />
      <path d="M38 52c-4 5-5 11-2 17" fill="none" stroke={C.cream} strokeWidth="3" opacity=".6" />
      <ellipse cx="97" cy="66" rx="10" ry="11" fill={C.terra} />
      <path d="M94 64v4m6-4v4" strokeWidth="2.2" />
      <circle cx="82" cy="57" r="2.5" fill={C.ink} stroke="none" />
      <g transform="translate(55 23) rotate(-12)">
        <ellipse rx="9" ry="13" fill={C.gold} />
        <ellipse rx="5" ry="9" fill="none" stroke={C.lightGold} strokeWidth="2" />
      </g>
      <path d="M54 8V4m-14 9-3-3m31 4 4-3" fill="none" stroke={C.gold} strokeWidth="1.8" />
    </>
  );
}

function Warehouse() {
  return (
    <>
      <Shadow rx={45} />
      <path d="M23 47h74v40H23Z" fill={C.wood} />
      <path d="M23 58h74M23 70h74M23 81h74" fill="none" stroke={C.bark} strokeWidth="1.3" />
      <path d="M18 49 60 17l43 32-8 6-35-25-35 25Z" fill={C.terra} />
      <path d="m29 42 31-23 32 24M41 38l9 4m9-17 8 7m8 0-7 7m-16-3-8 7m37-4-6 7" fill="none" stroke={C.bark} strokeWidth="1.6" />
      <path d="M46 53h28v34H46Z" fill={C.bark} />
      <path d="M60 54v33m-12-30 24 28m0-28L48 85" fill="none" stroke={C.pale} strokeWidth="1.6" />
      <path d="M23 48h6v39h-6m68-39h6v39h-6" fill={C.darkGreen} />
      <path d="M51 37h18v10H51Z" fill={C.cream} />
      <path d="M60 37v10m-9-5h18" fill="none" strokeWidth="1.5" />
      <path d="M16 87h88" fill="none" strokeWidth="3" />
    </>
  );
}

function Tool({ pickaxe = false }) {
  return (
    <>
      <Shadow x={60} y={89} rx={35} />
      <path d="m35 83 7 5 42-62-7-5Z" fill={C.wood} />
      <path d="m41 79 31-45" fill="none" stroke={C.cream} strokeWidth="1.6" opacity=".6" />
      {pickaxe ? (
        <>
          <path d="M33 22c23-13 56 2 64 23-16-12-34-18-53-15l-15 6Z" fill={C.stone} />
          <path d="M37 24c21-7 43 4 54 14" fill="none" stroke={C.cream} strokeWidth="2.2" />
          <path d="m63 25 12 8 5-7-11-8Z" fill={C.darkStone} />
        </>
      ) : (
        <>
          <path d="m55 18 18 11-10 16-22-5c-4-7-1-18 5-24Z" fill={C.stone} />
          <path d="m46 16 9 2-13 21-5-5c-1-8 3-16 9-18Z" fill={C.cream} />
          <path d="m70 23 12 7 8-10-14-9Z" fill={C.darkStone} />
          <path d="m55 22 8 5-5 8" fill="none" stroke={C.darkStone} strokeWidth="1.7" />
        </>
      )}
      <path d="m43 70 8 5m-5-10 8 5m-5-10 8 5" fill="none" stroke={C.bark} strokeWidth="2.7" />
    </>
  );
}

const artwork = {
  human: <Person />,
  corpse: <Person corpse />,
  tree: <Tree />,
  rock: <Rock />,
  berryBush: <BerryBush />,
  rat: <Rat />,
  soil: <Soil />,
  field: <Soil field />,
  pack: <Pack />,
  piggyBank: <PiggyBank />,
  warehouse: <Warehouse />,
  axe: <Tool />,
  pickaxe: <Tool pickaxe />,
  gold: (
    <>
      <Shadow rx={39} />
      <Coin x={40} y={78} />
      <Coin x={40} y={70} />
      <Coin x={40} y={62} />
      <Coin x={75} y={78} />
      <Coin x={75} y={70} />
      <Coin x={75} y={62} />
      <Coin x={75} y={54} />
      <Coin x={75} y={46} />
      <path d="m38 37 3-8 3 8 8 3-8 3-3 8-3-8-8-3Z" fill={C.lightGold} strokeWidth="1.5" />
      <path d="m88 24 2-5 2 5 5 2-5 2-2 5-2-5-5-2Z" fill={C.gold} stroke="none" />
    </>
  ),
  wood: (
    <>
      <Shadow rx={44} />
      <Log x={51} y={72} rotate={8} scale={.9} />
      <Log x={73} y={60} rotate={-8} scale={.9} />
      <Log x={50} y={45} rotate={6} scale={.9} />
      <Leaf x={87} y={40} rotate={-5} scale={.55} />
    </>
  ),
  stick: (
    <>
      <Shadow rx={37} />
      <path d="m31 80 8 5 45-59-5-5-17 23-2-22-6 1 2 29Z" fill={C.bark} />
      <path d="m71 81 7-3-18-25-5-27-6 1 2 20-12-10-4 5 17 17Z" fill={C.wood} />
      <path d="m37 77 19-26m18 26L62 59" fill="none" stroke={C.pale} strokeWidth="1.4" />
      <path d="m76 31 5 4M56 25l4-1m-23 15 4 3" stroke={C.cream} strokeWidth="2.5" />
      <Leaf x={64} y={43} rotate={18} scale={.65} />
    </>
  ),
  stone: (
    <>
      <Shadow rx={40} />
      <path d="m23 69 12-23 20-4 18 19-4 20-29 6Z" fill={C.stone} />
      <path d="m35 46 9 25-4 16m4-16 29-10m-29 10 25 10" fill="none" stroke={C.darkStone} strokeWidth="1.6" />
      <path d="m65 72 4-25 15-11 18 18-6 29-17 5Z" fill={C.stone} />
      <path d="m69 47 14 12 19-5M83 59l-4 29" fill="none" stroke={C.darkStone} strokeWidth="1.6" />
      <path d="m38 49 7-1m28 0 9-6" fill="none" stroke={C.cream} strokeWidth="3" opacity=".6" />
      <path d="m17 83 7-6 10 7-3 6H20Z" fill={C.darkStone} />
    </>
  ),
  flint: (
    <>
      <Shadow rx={35} />
      <path d="m30 76 6-25 16-28 22-9 11 22 9 18-12 29-23 6Z" fill={C.darkStone} />
      <path d="m36 51 23 8 15-45m-15 45 35-5m-35 5 23 24m-23-24v30m0-30-29 17M52 23l7 36" fill="none" stroke={C.ink} strokeWidth="1.5" />
      <path d="m53 29 4 17 11-22Zm31 12-18 16 21-6Z" fill={C.cream} opacity=".3" stroke="none" />
      <path d="m18 40 2-6 2 6 6 2-6 2-2 6-2-6-6-2Z" fill={C.gold} stroke="none" />
      <path d="m100 26 2-5 2 5 5 2-5 2-2 5-2-5-5-2Z" fill={C.gold} stroke="none" />
    </>
  ),
  berry: (
    <>
      <Shadow rx={32} />
      <Berry x={59} y={37} scale={2.1} rotate={-7} />
      <Leaf x={63} y={23} rotate={36} scale={.75} />
    </>
  ),
  bone: (
    <>
      <Shadow rx={35} />
      <path d="M35 59C20 60 17 47 25 42c-4-9 5-18 13-13 6 3 5 10 5 13l30 19c4-6 11-9 16-4 5 4 4 10 0 14 8 4 7 15-1 18-9 3-15-5-15-11L41 58Z" fill={C.cream} />
      <path d="m43 48 29 19m-44-23 5 5m50 24 4-2" fill="none" stroke={C.pale} strokeWidth="3" />
    </>
  ),
  meat: (
    <>
      <Shadow rx={38} />
      <path d="m75 62 15 10c8-6 16 2 11 8 2 8-8 12-12 5l-15-9Z" fill={C.cream} />
      <path d="M30 34c13-12 33-10 47 5 15 17 14 32 0 42-15 10-29 1-41-8-15-11-22-26-6-39Z" fill={C.terra} />
      <path d="M29 39c10-10 25-9 39 4 12 12 12 23 2 30-10 7-22 1-31-6-12-9-18-19-10-28Z" fill={C.red} />
      <path d="M37 43c6-5 15-4 23 3m-7 17c6 3 10 3 14-1" fill="none" stroke={C.lightTerra} strokeWidth="4" />
      <ellipse cx="48" cy="53" rx="8" ry="6" transform="rotate(35 48 53)" fill={C.cream} />
      <ellipse cx="48" cy="53" rx="3" ry="2" transform="rotate(35 48 53)" fill={C.bark} stroke="none" />
    </>
  ),
};

/** Decorative, deliberately text-free artwork for every game card. */
export default function CardArt({ type, className = '', ...props }) {
  return (
    <svg
      viewBox="0 0 120 100"
      width="100%"
      height="100%"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
      aria-hidden="true"
      focusable="false"
    >
      <g stroke={C.ink} strokeWidth="2.15" strokeLinecap="round" strokeLinejoin="round" fill={C.cream}>
        {artwork[type] || artwork.pack}
      </g>
    </svg>
  );
}
