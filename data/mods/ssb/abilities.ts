import {SSBSet, ssbSets} from "./random-teams";

/**
 * Assigns a new set to a Pokémon
 * @param pokemon the Pokemon to assign the set to
 * @param newSet the SSBSet to assign
 */
export function changeSet(context: Battle, pokemon: Pokemon, newSet: SSBSet, changeAbility = false) {
	// For some reason EVs and IVs in an SSBSet can be undefined...
	const evs: StatsTable = {
		hp: newSet.evs?.hp || 0,
		atk: newSet.evs?.atk || 0,
		def: newSet.evs?.def || 0,
		spa: newSet.evs?.spa || 0,
		spd: newSet.evs?.spd || 0,
		spe: newSet.evs?.spe || 0,
	};
	const ivs: StatsTable = {
		hp: newSet.ivs?.hp || 31,
		atk: newSet.ivs?.atk || 31,
		def: newSet.ivs?.def || 31,
		spa: newSet.ivs?.spa || 31,
		spd: newSet.ivs?.spd || 31,
		spe: newSet.ivs?.spe || 31,
	};
	pokemon.set.evs = evs;
	pokemon.set.ivs = ivs;
	if (newSet.nature) pokemon.set.nature = Array.isArray(newSet.nature) ? context.sample(newSet.nature) : newSet.nature;
	pokemon.formeChange(newSet.species, context.effect, true);
	if (changeAbility) pokemon.setAbility(newSet.ability as string);

	pokemon.baseMaxhp = Math.floor(Math.floor(
		2 * pokemon.species.baseStats.hp + pokemon.set.ivs.hp + Math.floor(pokemon.set.evs.hp / 4) + 100
	) * pokemon.level / 100 + 10);
	const newMaxHP = pokemon.baseMaxhp;
	pokemon.hp = newMaxHP - (pokemon.maxhp - pokemon.hp);
	pokemon.maxhp = newMaxHP;
	let item = newSet.item;
	if (typeof item !== 'string') item = item[Math.floor(Math.random() * item.length)];
	pokemon.setItem(item);
	const newMoves = changeMoves(context, pokemon, newSet.moves.concat(newSet.signatureMove));
	pokemon.moveSlots = newMoves;
	// @ts-ignore Necessary so Robb576 doesn't get 8 moves
	pokemon.baseMoveSlots = newMoves;
}

/**
 * Assigns new moves to a Pokemon
 * @param pokemon The Pokemon whose moveset is to be modified
 * @param newSet The set whose moves should be assigned
 */
export function changeMoves(context: Battle, pokemon: Pokemon, newMoves: (string | string[])[]) {
	const carryOver = pokemon.moveSlots.slice().map(m => m.pp / m.maxpp);
	// In case there are ever less than 4 moves
	while (carryOver.length < 4) {
		carryOver.push(1);
	}
	const result = [];
	let slot = 0;
	for (const newMove of newMoves) {
		const moveName = Array.isArray(newMove) ? newMove[context.random(newMove.length)] : newMove;
		const move = pokemon.battle.dex.getMove(context.toID(moveName));
		if (!move.id) continue;
		const moveSlot = {
			move: move.name,
			id: move.id,
			pp: ((move.noPPBoosts || move.isZ) ? Math.floor(move.pp * carryOver[slot]) : move.pp * 8 / 5),
			maxpp: ((move.noPPBoosts || move.isZ) ? move.pp : move.pp * 8 / 5),
			target: move.target,
			disabled: false,
			disabledSource: '',
			used: false,
		};
		result.push(moveSlot);
		slot++;
	}
	return result;
}

export const Abilities: {[k: string]: ModdedAbilityData} = {
	/*
	// Example
	"abilityid": {
		desc: "", // long description
		shortDesc: "", // short description, shows up in /dt
		name: "Ability Name",
		// The bulk of an ability is not easily shown in an example since it varies
		// For more examples, see https://github.com/smogon/pokemon-showdown/blob/master/data/abilities.js
	},
	*/
	// Please keep abilites organized alphabetically based on staff member name!
	// Aelita
	scyphozoa: {
		desc: "This clears everything on both sides on switch in. This Pokemon's moves ignore abilities. If this Pokemon is a Zygarde in its 10% or 50% Forme, it changes to Complete Forme when it has 1/2 or less of its maximum HP at the end of the turn.",
		shortDesc: "Clears everything on both sides. Moves ignore abilities. Zygarde can become 100% form.",
		name: "Scyphozoa",
		onSwitchIn(source) {
			this.add('-ability', source, 'Scyphozoa');
			const target = source.side.foe.active[0];

			const removeAll = [
				'reflect', 'lightscreen', 'auroraveil', 'safeguard', 'mist', 'spikes', 'toxicspikes', 'stealthrock', 'shiftingrocks', 'stickyweb',
			];
			const silentRemove = ['reflect', 'lightscreen', 'auroraveil', 'safeguard', 'mist'];
			for (const sideCondition of removeAll) {
				if (target.side.removeSideCondition(sideCondition)) {
					if (!(silentRemove.includes(sideCondition))) {
						this.add('-sideend', target.side, this.dex.getEffect(sideCondition).name, '[from] ability: Scyphozoa', '[of] ' + source);
					}
				}
				if (source.side.removeSideCondition(sideCondition)) {
					if (!(silentRemove.includes(sideCondition))) {
						this.add('-sideend', source.side, this.dex.getEffect(sideCondition).name, '[from] ability: Scyphozoa', '[of] ' + source);
					}
				}
			}
			this.add('-clearallboost');
			for (const pokemon of this.getAllActive()) {
				pokemon.clearBoosts();
			}
			for (const clear in this.field.pseudoWeather) {
				if (clear.endsWith('mod') || clear.endsWith('clause')) continue;
				this.field.removePseudoWeather(clear);
			}
			this.field.clearWeather();
			this.field.clearTerrain();
		},
		onModifyMove(move) {
			move.ignoreAbility = true;
		},
		onResidualOrder: 27,
		onResidual(pokemon) {
			if (pokemon.baseSpecies.baseSpecies !== 'Zygarde' || pokemon.transformed || !pokemon.hp) return;
			if (pokemon.species.id === 'zygardecomplete' || pokemon.hp > pokemon.maxhp / 2) return;
			this.add('-activate', pokemon, 'ability: Scyphozoa');
			pokemon.formeChange('Zygarde-Complete', this.effect, true);
			pokemon.baseMaxhp = Math.floor(Math.floor(
				2 * pokemon.species.baseStats['hp'] + pokemon.set.ivs['hp'] + Math.floor(pokemon.set.evs['hp'] / 4) + 100
			) * pokemon.level / 100 + 10);
			const newMaxHP = pokemon.volatiles['dynamax'] ? (2 * pokemon.baseMaxhp) : pokemon.baseMaxhp;
			pokemon.hp = newMaxHP - (pokemon.maxhp - pokemon.hp);
			pokemon.maxhp = newMaxHP;
			this.add('-heal', pokemon, pokemon.getHealth, '[silent]');
		},
	},

	// aegii
	newstage: {
		desc: "Stance Change; Haze, Heal Bell and Embargo start on switch in.",
		shortDesc: "Stance Change; Haze, Heal Bell and Embargo start on switch in.",
		onBeforeMovePriority: 0.5,
		onBeforeMove(attacker, defender, move) {
			if (attacker.species.baseSpecies !== 'Aegislash' || attacker.transformed) return;
			if (move.category === 'Status' && move.id !== 'kingsshield' && move.id !== 'kshield') return;
			const targetForme = (move.id === 'kingsshield' || move.id === 'kshield' ? 'Aegislash' : 'Aegislash-Blade');
			if (attacker.species.name !== targetForme) attacker.formeChange(targetForme);
		},
		onStart(pokemon) {
			this.useMove('Haze', pokemon);
			this.useMove('Heal Bell', pokemon);
			this.useMove('Embargo', pokemon);
		},
		name: "New Stage",
	},

	// Aeonic
	arsene: {
		desc: "On switch-in, this Pokemon summons Sandstorm. If Sandstorm is active, this Pokemon's Speed is doubled. This Pokemon takes no damage from Sandstorm.",
		shortDesc: "Sand Stream + Sand Rush.",
		name: "Arsene",
		onStart(source) {
			this.field.setWeather('sandstorm');
		},
		onModifySpe(spe, pokemon) {
			if (this.field.isWeather('sandstorm')) {
				return this.chainModify(2);
			}
		},
		onImmunity(type, pokemon) {
			if (type === 'sandstorm') return false;
		},
	},

	// Aethernum
	rainyseason: {
		desc: "On switch-in, the weather becomes heavy rain that prevents damaging Fire-type moves from executing, in addition to all the effects of Rain Dance. This weather remains in effect until this Ability is no longer active for any Pokemon, or the weather is changed by Delta Stream, Desolate Land, or Heavy Hailstorm. If Rain Dance is active, this Pokemon restores 1/8 of its maximum HP, rounded down, at the end of each turn. If this Pokemon is holding Big Root, it will restore 1/6 of its maximum HP, rounded down, at the end of the turn. If this Pokemon is holding Utility Umbrella, its HP does not get restored. This Pokemon collects raindrops.",
		shortDesc: "Primordial Sea + Swift Swim. Restore HP if raining. Collect raindrops.",
		name: "Rainy Season",
		onStart(source) {
			this.field.setWeather('primordialsea');
		},
		onAnySetWeather(target, source, weather) {
			const strongWeathers = ['desolateland', 'primordialsea', 'deltastream', 'heavyhailstorm'];
			if (this.field.getWeather().id === 'primordialsea' && !strongWeathers.includes(weather.id)) return false;
		},
		onEnd(pokemon) {
			if (this.field.weatherData.source !== pokemon) return;
			for (const target of this.getAllActive()) {
				if (target === pokemon) continue;
				if (target.hasAbility('primordialsea')) {
					this.field.weatherData.source = target;
					return;
				}
			}
			this.field.clearWeather();
		},
		onWeather(target, source, effect) {
			if (target.hasItem('utilityumbrella')) return;
			if (effect.id === 'raindance' || effect.id === 'primordialsea') {
				if (!target.hasItem('Big Root')) {
					this.heal(target.baseMaxhp / 8);
				} else {
					this.heal(target.baseMaxhp / 6);
				}
				if (!target.volatiles['raindrop']) target.addVolatile('raindrop');
			}
		},
		onModifySpe(spe, pokemon) {
			if (['raindance', 'primordialsea'].includes(pokemon.effectiveWeather())) {
				return this.chainModify(2);
			}
		},
	},

	// Akir
	fortifications: {
		desc: "Sets up 1 layer of Spikes on switch in; opponent takes 1/16 damage if makes contact; Restores 1/16 of its max HP every turn.",
		shortDesc: "Sets up 1 layer of Spikes on switch in; opponent takes 1/16 damage if makes contact; Restores 1/16 of its max HP every turn.",
		onSwitchInPriority: 1,
		onSwitchIn(pokemon) {
			this.add('-ability', pokemon, 'Fortifications', pokemon.side.foe);
			pokemon.side.foe.addSideCondition('spikes');
		},
		onDamagingHitOrder: 1,
		onDamagingHit(damage, target, source, move) {
			if (move.flags['contact']) {
				this.damage(source.baseMaxhp / 16, source, target);
			}
		},
		onResidual(pokemon) {
			this.heal(pokemon.baseMaxhp / 16);
		},
		name: "Fortifications",
	},

	// Annika
	overprotective: {
		desc: "If this Pokemon is the last unfainted team member, its Speed is raised by 1 stage.",
		shortDesc: "+1 Speed on switch-in if all other team members have fainted.",
		onSwitchIn(pokemon) {
			if (pokemon.side.pokemonLeft === 1) this.boost({spe: 1});
		},
		name: "Overprotective",
	},

	// A Quag To The Past
	carefree: {
		shortDesc: "Magic Bounce + Unaware.",
		onAnyModifyBoost(boosts, pokemon) {
			const unawareUser = this.effectData.target;
			if (unawareUser === pokemon) return;
			if (unawareUser === this.activePokemon && pokemon === this.activeTarget) {
				boosts['def'] = 0;
				boosts['spd'] = 0;
				boosts['evasion'] = 0;
			}
			if (pokemon === this.activePokemon && unawareUser === this.activeTarget) {
				boosts['atk'] = 0;
				boosts['def'] = 0;
				boosts['spa'] = 0;
				boosts['accuracy'] = 0;
			}
		},
		onTryHitPriority: 1,
		onTryHit(target, source, move) {
			if (target === source || move.hasBounced || !move.flags['reflectable']) {
				return;
			}
			const newMove = this.dex.getActiveMove(move.id);
			newMove.hasBounced = true;
			newMove.pranksterBoosted = false;
			this.useMove(newMove, target, source);
			return null;
		},
		onAllyTryHitSide(target, source, move) {
			if (target.side === source.side || move.hasBounced || !move.flags['reflectable']) {
				return;
			}
			const newMove = this.dex.getActiveMove(move.id);
			newMove.hasBounced = true;
			newMove.pranksterBoosted = false;
			this.useMove(newMove, this.effectData.target, source);
			return null;
		},
		condition: {
			duration: 1,
		},
		name: "Carefree",
	},

	// a random duck
	galewingsv1: {
		desc: "If this Pokemon is at full HP, its Flying-type moves have their priority increased by 1.",
		shortDesc: "This Pokemon's Flying-type moves have their priority increased by 1.",
		onModifyPriority(priority, pokemon, target, move) {
			if (move && move.type === 'Flying') return priority + 1;
		},
		name: "Gale Wings v1",
	},

	// ArchasTL
	indomitable: {
		desc: "This Pokemon cures itself if it is confused or has a major status condition. Single use.",
		onTryAddVolatile(status, pokemon) {
			if (status.id === 'confusion' && !pokemon.m.indomitableActivated) {
				pokemon.m.indomitableActivated = true;
				return null;
			}
		},
		onSetStatus(status, target, source, effect) {
			if (!target.status) return;
			if (target.m.indomitableActivated) return;
			this.add('-immune', target, '[from] ability: Indomitable');
			target.m.indomitableActivated = true;
			return false;
		},
		onUpdate(pokemon) {
			if ((pokemon.status || pokemon.volatiles['confusion']) && !pokemon.m.indomitableActivated) {
				this.add('-activate', pokemon, 'ability: Indomitable');
				pokemon.cureStatus();
				pokemon.m.indomitableActivated = true;
			}
		},
		name: "Indomitable",
	},

	// Arsenal
	royalprivilege: {
		desc: "This Pokemon is not affected by the secondary effect of another Pokemon's attack. This Pokemon can only be damaged by direct attacks. Attacks that need to charge do not charge and execute in 1 turnThis Pokemon is not affected by the secondary effect of another Pokemon's attack. This Pokemon can only be damaged by direct attacks. Attacks that need to charge do not charge and execute in 1 turn.",
		shortDesc: "Magic Guard + Shield Dust + Power Herb",
		name: "Royal Privilege",
		onDamage(damage, target, source, effect) {
			if (effect.effectType !== 'Move') {
				if (effect.effectType === 'Ability') this.add('-activate', source, 'ability: ' + effect.name);
				return false;
			}
		},
		onModifySecondaries(secondaries) {
			this.debug('Shield Dust prevent secondary');
			return secondaries.filter(effect => !!(effect.self || effect.dustproof));
		},
		onChargeMove(pokemon, target, move) {
			if (pokemon.useItem()) {
				this.debug('power herb - remove charge turn for ' + move.id);
				this.attrLastMove('[still]');
				this.addMove('-anim', pokemon, move.name, target);
				return false; // skip charge turn
			}
		},
	},

	// biggie
	superarmor: {
		shortDesc: "Reduces damage taken from physical moves by 25% if the user has not yet attacked.",
		onSourceModifyDamage(damage, source, target, move) {
			if (this.queue.willMove(target) && move.category === 'Physical') {
				return this.chainModify(0.75);
			}
		},
		name: "Super Armor",
	},

	// cant say
	ragequit: {
		desc: "If Pokemon with this ability uses a move that misses or fails it faints and gives -2 Atk / -2 SpA to foe",
		shortDesc: "If move misses or fails, apply memento.",
		name: "Rage Quit",
		onAfterMove(pokemon, target, move) {
			if (pokemon.moveThisTurnResult === false) {
				this.add('-ability', pokemon, 'Rage Quit', 'boost');
				pokemon.faint();
				if (pokemon.side.foe.active[0]) {
					this.boost({atk: -2, spa: -2}, pokemon.side.foe.active[0], pokemon);
				}
			}
		},
	},

	// Celine 
	guardianarmor: {
		desc: "Raises Defense and Special Defense by two stages upon switch in.",
		shortDesc: "+2 Def and SpD on switch in.",
		name: "Guardian Armor",
		onStart(pokemon) {
			this.boost({def: 2, spd: 2});
		},
	},

	// Darth
	guardianangel: {
		desc: "This Pokemon restores 1/3 of its maximum HP, rounded down, when it switches out. When switching in, this Pokemon's types are changed to resist the weakness of the last and stats Pokemon in before it.",
		shortDesc: "Switching out: Regenerator. Switching in: Resists Weaknesses of last Pokemon.",
		name: "Guardian Angel",
		onSwitchOut(pokemon) {
			pokemon.heal(pokemon.baseMaxhp / 3);
		},
		onSwitchIn(pokemon) {
			const possibleTypes = [];
			const newTypes = [];
			const weaknesses = [];
			const types = pokemon.side.sideConditions['tracker'].storedTypes;
			if (!types) return;
			for (const type in this.dex.data.TypeChart) {
				const typeMod = this.dex.getEffectiveness(type, types);
				if (typeMod > 0 && this.dex.getImmunity(type, types)) weaknesses.push(type);
			}
			const combo = this.sample(weaknesses);
			for (const type in this.dex.data.TypeChart) {
				const typeCheck = this.dex.data.TypeChart[type].damageTaken[combo];
				if (typeCheck === 2 || typeCheck === 3) {
					possibleTypes.push(type);
				}
			}
			if (possibleTypes.length < 2) return;

			newTypes.push(this.sample(possibleTypes), this.sample(possibleTypes));
			while (newTypes[0] === newTypes[1] && possibleTypes.length > 1) {
				newTypes[1] = this.sample(possibleTypes);
			}

			if (!pokemon.setType(newTypes)) return;
			this.add('-start', pokemon, 'typechange', newTypes.join('/'));
		},
	},

	// drampa's grandpa
	oldmanpa: {
		desc: "This Pokemon's sound-based moves have their power multiplied by 1.3. This Pokemon takes halved damage from sound-based moves. This Pokemon ignores other Pokemon's Attack, Special Attack, and accuracy stat stages when taking damage, and ignores other Pokemon's Defense, Special Defense, and evasiveness stat stages when dealing damage. Upon switching in, this Pokemon's Defense and Special Defense are raised by 1 stage.",
		shortDesc: "Effects of Punk Rock + Unaware. On switch-in, boosts Def and Sp. Def by 1.",
		name: "Old Manpa",
		onBasePowerPriority: 7,
		onBasePower(basePower, attacker, defender, move) {
			if (move.flags['sound']) {
				this.debug('Old Manpa boost');
				return this.chainModify([0x14CD, 0x1000]);
			}
		},
		onSourceModifyDamage(damage, source, target, move) {
			if (move.flags['sound']) {
				this.debug('Old Manpa weaken');
				return this.chainModify(0.5);
			}
		},
		onAnyModifyBoost(boosts, pokemon) {
			const unawareUser = this.effectData.target;
			if (unawareUser === pokemon) return;
			if (unawareUser === this.activePokemon && pokemon === this.activeTarget) {
				boosts['def'] = 0;
				boosts['spd'] = 0;
				boosts['evasion'] = 0;
			}
			if (pokemon === this.activePokemon && unawareUser === this.activeTarget) {
				boosts['atk'] = 0;
				boosts['def'] = 0;
				boosts['spa'] = 0;
				boosts['accuracy'] = 0;
			}
		},
		onStart(pokemon) {
			this.boost({def: 1, spd: 1});
		},
	},

	// dream
	greedpunisher: {
		desc: "This Pokemon can only be damaged by direct attacks. On switch-in, this Pokemon's stats are boosted based on the number of hazards on the field. 1 stat is raised if 1-2 hazards are up, and 2 stats are raised if 3 or more hazards are up.",
		shortDesc: "On switch-in, boosts stats based on the number of hazards up on this Pokemon's side.",
		name: "Greed Punisher",
		onSwitchIn(pokemon) {
			const side = pokemon.side;
			const activeCount = Object.keys(side.sideConditions).length;
			if (activeCount > 0) {
				const stats: BoostName[] = [];
				let i = 0;
				while (i <= activeCount) {
					let stat: BoostName;
					for (stat in pokemon.boosts) {
						if (stat === 'evasion' || stat === 'accuracy' || stats.includes(stat)) continue;
						if (pokemon.boosts[stat] < 6) {
							stats.push(stat);
							i++;
						}
					}
				}
				if (stats.length) {
					const randomStat = this.sample(stats);
					const boost: {[k: string]: number} = {};
					boost[randomStat] = 1;
					this.boost(boost, pokemon);
				} else {
					return false;
				}
			}
		},
		onDamage(damage, target, source, effect) {
			if (effect.effectType !== 'Move') {
				if (effect.effectType === 'Ability') this.add('-activate', source, 'ability: ' + effect.name);
				return false;
			}
		},
	},

	// Emeri
	dracovoice: {
		desc: "This Pokemon's sound-based moves become Dragon-type moves. This effect comes after other effects that change a move's type, but before Ion Deluge and Electrify's effects.",
		shortDesc: "This Pokemon's sound-based moves become Dragon type.",
		name: "Draco Voice",
		onModifyTypePriority: -1,
		onModifyType(move, pokemon) {
			if (move.flags['sound'] && !pokemon.volatiles.dynamax) { // hardcode
				move.type = 'Dragon';
			}
		},
	},

	// EpicNikolai
	dragonheart: {
		desc: "Once per battle, at 25% or lower this pokemon heals 50% hp.",
		shortDesc: "Heals 50% when 25% or lower once per battle.",
		name: "Dragon Heart",
		onDamage(damage, target, source, move) {
			if (target.m.heartless) return;
			if (target.hp <= target.maxhp / 4) {
				this.heal(target.baseMaxhp / 2);
				target.m.heartless = true;
			}
		},
	},

	// fart
	bipolar: {
		desc: "When this Pokemon switches in, it changes to two random types and gets STAB.",
		shortDesc: "2 random types + STAB on switch-in.",
		name: "Bipolar",
		onSwitchIn(pokemon) {
			const typeMap: {[key: string]: string} = {
				Normal: "Return",
				Fighting: "Sacred Sword",
				Flying: "Drill Peck",
				Poison: "Poison Jab",
				Ground: "Earthquake",
				Rock: "Stone Edge",
				Bug: "Lunge",
				Ghost: "Shadow Bone",
				Steel: "Iron Head",
				Electric: "Zing Zap",
				Psychic: "Psychic Fangs",
				Ice: "Icicle Crash",
				Dragon: "Dual Chop",
				Dark: "Jaw Lock",
				Fairy: "Play Rough",
			};
			const types = Object.keys(typeMap);
			this.prng.shuffle(types);
			const newTypes = [types[0], types[1]];
			this.add('-start', pokemon, 'typechange', newTypes.join('/'));
			pokemon.setType(newTypes);
			let move = this.dex.getMove(typeMap[newTypes[0]]);
			pokemon.moveSlots[3] = pokemon.moveSlots[1];
			pokemon.moveSlots[1] = {
				move: move.name,
				id: move.id,
				pp: move.pp,
				maxpp: move.pp,
				target: move.target,
				disabled: false,
				used: false,
				virtual: true,
			};
			move = this.dex.getMove(typeMap[newTypes[1]]);
			pokemon.moveSlots[2] = {
				move: move.name,
				id: move.id,
				pp: move.pp,
				maxpp: move.pp,
				target: move.target,
				disabled: false,
				used: false,
				virtual: true,
			};
		},
	},

	// Frostyicelad
	iceshield: {
		desc: "This Pokemon receives 1/2 damage from special attacks. This Pokemon can only be damaged by direct attacks. Curse and Substitute on use, Belly Drum, Pain Split, Struggle recoil, and confusion damage are considered direct damage.",
		shortDesc: "Receives 1/2 dmg from SpAtks. This Pokemon can only be damaged by direct attacks.",
		name: "Ice Shield",
		onSourceModifyDamage(damage, source, target, move) {
			if (move.category === 'Special') {
				return this.chainModify(0.5);
			}
		},
		onDamage(damage, target, source, effect) {
			if (effect.effectType !== 'Move') {
				if (effect.effectType === 'Ability') this.add('-activate', source, 'ability: ' + effect.name);
				return false;
			}
		},
	},

	// GXS
	virusupload: {
		desc: "On switch-in, this Pokemon's Attack or Special Attack is raised by 1 stage based on the weaker combined defensive stat of all opposing Pokemon. Attack is raised if their Defense is lower, and Special Attack is raised if their Special Defense is the same or lower.",
		shortDesc: "On switch-in, Attack or Sp. Atk is raised 1 stage based on the foes' weaker Defense.",
		name: "Virus Upload",
		onStart(pokemon) {
			let totalatk = 0;
			let totalspa = 0;
			let targ;
			for (const target of pokemon.side.foe.active) {
				if (!target || target.fainted) continue;
				targ = target;
				totalatk += target.getStat('atk', false, true);
				totalspa += target.getStat('spa', false, true);
			}
			if (targ) {
				if (totalatk && totalatk >= totalspa) {
					this.boost({atk: -1}, targ, pokemon);
				} else if (totalspa) {
					this.boost({spa: -1}, targ, pokemon);
				}
			}
		},
	},

	// grimAuxiliatrix
	biosteel: {
		desc: "This Pokemon restores 1/3 of its maximum HP, rounded down, when it switches out and prevents other Pokemon from lowering this Pokemon's stat stages.",
		shortDesc: "This Pokemon restores 1/3 max HP when it switches out. Other Pokemon can't lower this Pokemon's stat stages.",
		name: "Bio-steel",
		isUnbreakable: true,
		onSwitchOut(pokemon) {
			pokemon.heal(pokemon.baseMaxhp / 3);
		},
		onBoost(boost, target, source, effect) {
			if (source && target === source) return;
			let showMsg = false;
			let i: BoostName;
			for (i in boost) {
				if (boost[i]! < 0) {
					delete boost[i];
					showMsg = true;
				}
			}
			if (showMsg && !(effect as ActiveMove).secondaries && effect.id !== 'octolock') {
				this.add("-fail", target, "unboost", "[from] ability: Bio-steel", "[of] " + target);
			}
		},
	},

	// Hydro
	hydrostatic: {
		desc: "This Pokemon is immune to Water- and Electric-type moves and raises its Special Attack by 1 stage when hit by a Water- or Electric-type move. If this Pokemon is not the target of a single-target Water- or Electric-type move used by another Pokemon, this Pokemon redirects that move to itself if it is within the range of that move. This Pokemon's Water- and Electric-type moves have their accuracy multiplied by 1.3.",
		shortDesc: "Storm Drain + Lightning Rod. Water/Electric moves used by this Pokemon have 1.3x acc.",
		onSourceModifyAccuracyPriority: 9,
		onSourceModifyAccuracy(accuracy, source, target, move) {
			if (typeof accuracy !== 'number') return;
			if (!['Water', 'Electric'].includes(move.type)) return;
			this.debug('hydrostatic - enhancing accuracy');
			return accuracy * 1.3;
		},
		onTryHit(target, source, move) {
			if (target !== source && ['Water', 'Electric'].includes(move.type)) {
				if (!this.boost({spa: 1})) {
					this.add('-immune', target, '[from] ability: Hydrostatic');
				}
				return null;
			}
		},
		onAnyRedirectTarget(target, source, source2, move) {
			if (!['Water', 'Electric'].includes(move.type) ||
				['firepledge', 'grasspledge', 'waterpledge'].includes(move.id)) return;
			const redirectTarget = ['randomNormal', 'adjacentFoe'].includes(move.target) ? 'normal' : move.target;
			if (this.validTarget(this.effectData.target, source, redirectTarget)) {
				if (move.smartTarget) move.smartTarget = false;
				if (this.effectData.target !== target) {
					this.add('-activate', this.effectData.target, 'ability: Hydrostatic');
				}
				return this.effectData.target;
			}
		},
		name: "Hydrostatic",
	},

	// Inactive
	dragonscale: {
		shortDesc: "If this Pokemon gets statused, its Def is 1.5x and it restores 25% HP.",
		onModifyDefPriority: 6,
		onModifyDef(def, pokemon) {
			if (pokemon.status) {
				return this.chainModify(1.5);
			}
		},
		onSetStatus(status, target, source, effect) {
			target.heal(target.baseMaxhp / 4);
		},
		name: "Dragon Scale",
	},

	// Iyarito
	pollodiablo: {
		shortDesc: "This Pokemon's Special Attack is 1.5x, but it can only select the first move it executes.",
		name: "Pollo Diablo",
		onStart(pokemon) {
			pokemon.abilityData.choiceLock = "";
		},
		onBeforeMove(pokemon, target, move) {
			if (move.isZOrMaxPowered || move.id === 'struggle') return;
			if (pokemon.abilityData.choiceLock && pokemon.abilityData.choiceLock !== move.id) {
				this.addMove('move', pokemon, move.name);
				this.attrLastMove('[still]');
				this.debug("Disabled by Pollo Diablo");
				this.add('-fail', pokemon);
				return false;
			}
		},
		onModifyMove(move, pokemon) {
			if (pokemon.abilityData.choiceLock || move.isZOrMaxPowered || move.id === 'struggle') return;
			pokemon.abilityData.choiceLock = move.id;
		},
		onModifySpAPriority: 1,
		onModifySpA(spa, pokemon) {
			if (pokemon.volatiles['dynamax']) return;
			this.debug('Pollo Diablo Spa Boost');
			return this.chainModify(1.5);
		},
		onDisableMove(pokemon) {
			if (!pokemon.abilityData.choiceLock) return;
			if (pokemon.volatiles['dynamax']) return;
			for (const moveSlot of pokemon.moveSlots) {
				if (moveSlot.id !== pokemon.abilityData.choiceLock) {
					pokemon.disableMove(moveSlot.id, false, this.effectData.sourceEffect);
				}
			}
		},
		onEnd(pokemon) {
			pokemon.abilityData.choiceLock = "";
		},
	},

	// Jett x~x
	deceiver: {
		desc: "This Pokemon's moves that match one of its types have a same-type attack bonus of 2 instead of 1.5. If this Pokemon is at full HP, it survives one hit with at least 1 HP.",
		shortDesc: "Adaptability + Sturdy.",
		onModifyMove(move) {
			move.stab = 2;
		},
		onTryHit(pokemon, target, move) {
			if (move.ohko) {
				this.add('-immune', pokemon, '[from] ability: Deceiver');
				return null;
			}
		},
		onDamagePriority: -100,
		onDamage(damage, target, source, effect) {
			if (target.hp === target.maxhp && damage >= target.hp && effect && effect.effectType === 'Move') {
				this.add('-ability', target, 'Deceiver');
				return target.hp - 1;
			}
		},
		name: "Deceiver",
	},

	// Jho
	venomize: {
		desc: "This Pokemon's sound-based moves become Poison-type moves. This effect comes after other effects that change a move's type, but before Ion Deluge and Electrify's effects.",
		shortDesc: "This Pokemon's sound-based moves become Poison type.",
		onModifyTypePriority: -1,
		onModifyType(move, pokemon) {
			if (move.flags['sound'] && !pokemon.volatiles['dynamax']) { // hardcode
				move.type = 'Poison';
			}
		},
		name: "Venomize",
	},

	// Jordy
	divinesandstorm: {
		desc: "This Pokemon does not take recoil damage besides Struggle/Life Orb/crash damage and switch-in, this Pokemon summons Sandstorm.",
		shortDesc: "Sand Stream + Rock Head.",
		name: "Divine Sandstorm",
		onDamage(damage, target, source, effect) {
			if (effect.id === 'recoil') {
				if (!this.activeMove) return;
				if (this.activeMove.id !== 'struggle') return null;
			}
		},
		onStart(pokemon) {
			this.field.setWeather('sandstorm');
		},
	},

	// Kaiju Bunny
	secondwind: {
		desc: "This Pokemon restores 1/2 of its HP if it falls below 1/4 of its maximum HP by an enemy attack. This effect only occurs once.",
		shortDesc: "If hit below 1/4 HP, heal 1/2 max HP. One time.",
		name: "Second Wind",
		onDamagingHit(damage, target, source, move) {
			if (move && target.hp > 0 && target.hp < target.maxhp / 4 && !target.m.secondwind) {
				target.m.secondwind = true;
				this.heal(target.maxhp / 2);
			}
		},
	},

	// KennedyLFC
	falsenine: {
		desc: "This Pokemon's type changes to match the type of the move it is about to use. This effect comes after all effects that change a move's type. This Pokemon's critical hit ratio is raised by 1 stage.",
		shortDesc: "Pokemon's type changes to match the type of the move it's about to use. +1 crit ratio.",
		onPrepareHit(source, target, move) {
			if (move.hasBounced) return;
			const type = move.type;
			if (type && type !== '???' && source.getTypes().join() !== type) {
				if (!source.setType(type)) return;
				this.add('-start', source, 'typechange', type, '[from] ability: Libero');
			}
		},
		onModifyCritRatio(critRatio) {
			return critRatio + 1;
		},
		name: "False Nine",
	},

	// KingSwordYT
	bambookingdom: {
		desc: "On switch-in, this Pokemon's Defense and Special Defense are raised by 1 stage. Pokemon using physical moves against this Pokemon lose 1/8 of their maximum HP. Pokemon using special moves against this Pokemon lose 1/16 of their maximum HP. Attacking moves have their priority set to -7.",
		shortDesc: "+1 Def/SpD. -7 priority on attacks. 1/8 recoil when hit with physical move, 1/16 when hit with special move.",
		name: "Bamboo Kingdom",
		onStart(pokemon) {
			this.boost({def: 1, spd: 1}, pokemon);
		},
		onModifyPriority(priority, pokemon, target, move) {
			if (move?.category !== 'Status') return -7;
		},
		onDamagingHit(damage, target, source, move) {
			if (move.category === 'Physical') {
				this.damage(source.baseMaxhp / 8, source, target);
			}
			if (move.category === 'Special') {
				this.damage(source.baseMaxhp / 16, source, target);
			}
		},
	},

	// Lionyx
	tension: {
		desc: "On switch-in, the Pokémon builds up tension, making its next hit a critical hit, and guaranteeing that it will hit.",
		shortDesc: "On switch-in, the Pokemon's next attack will always be a critical hit and will always hit.",
		name: "Tension",
		onStart(pokemon) {
			this.add("-message", `Lionyx has built up tension!`);
			// i could just add laserfocus and lockon volatiles here but its an ability soooo
			pokemon.addVolatile('tension');
		},
		condition: {
			onStart(pokemon, source, effect) {
				if (effect && (['imposter', 'psychup', 'transform'].includes(effect.id))) {
					this.add('-start', pokemon, 'move: Tension', '[silent]');
				} else {
					this.add('-start', pokemon, 'move: Tension');
				}
			},
			onModifyCritRatio(critRatio) {
				return 5;
			},
			onAnyInvulnerability(target, source, move) {
				if (move && (source === this.effectData.target || target === this.effectData.target)) return 0;
			},
			onAnyAccuracy(accuracy, target, source, move) {
				if (move && (source === this.effectData.target || target === this.effectData.target)) {
					return true;
				}
				return accuracy;
			},
			onAfterMove(pokemon, source) {
				pokemon.removeVolatile('tension');
			},
			onEnd(pokemon) {
				this.add('-end', pokemon, 'move: Tension', '[silent]');
			},
		},
	},

	// Marshmallon
	stubbornness: {
		desc: "this Pokemon does not take recoil damage; its Atk, Def, and SpD are immediately raised by 1 at the first instance that an opponent's stat is raised; after this, each time an opponent's has its stats boosted, the user gains +1 Atk.",
		shortDesc: "Rock Head + boosts its Atk, Def, SpD by 1 on opponents first stat boost; after which with every of opponent's stat boost it raises its Atk by 1.",
		name: "Stubbornness",
		onDamage(damage, target, source, effect) {
			if (effect.id === 'recoil') {
				if (!this.activeMove) throw new Error("Battle.activeMove is null");
				if (this.activeMove.id !== 'struggle') return null;
			}
		},
		onSwitchOut(pokemon) {
			if (pokemon.m.happened) delete pokemon.m.happened;
		},
		onFoeAfterBoost(boost, target, source, effect) {
			const pokemon = source.side.foe.active[0];
			let success = false;
			let i: BoostName;
			for (i in boost) {
				if (boost[i]! > 0) {
					success = true;
				}
			}
			// Infinite Loop preventer
			if (effect.id === 'stubbornness') return;
			if (success) {
				if (!pokemon.m.happened) {
					this.boost({atk: 1, def: 1, spd: 1}, pokemon);
					pokemon.m.happened = true;
				} else {
					this.boost({atk: 1}, pokemon);
				}
			}
		},
	},

	// Mitsuki
	photosynthesis: {
		desc: "On switch-in, this Pokemon summons Sunny Day. If Sunny Day is active and this Pokemon is not holding Utility Umbrella, this Pokemon's Speed is doubled. If Sunny Day is active, this Pokemon's Attack is multiplied by 1.5 and it loses 1/8 of its maximum HP, rounded down, at the end of each turn. If this Pokemon is holding Utility Umbrella, its Attack remains the same and it does not lose any HP.",
		shortDesc: "Summons Sunny Day. Under sun, 2x Speed, 1.5x Attack. End of turn: lose 1/8 max HP.",
		name: "Photosynthesis",
		onStart(source) {
			for (const action of this.queue) {
				if (action.choice === 'runPrimal' && action.pokemon === source && source.species.id === 'groudon') return;
				if (action.choice !== 'runSwitch' && action.choice !== 'runPrimal') break;
			}
			this.field.setWeather('sunnyday');
		},
		onModifySpe(spe, pokemon) {
			if (['sunnyday', 'desolateland'].includes(pokemon.effectiveWeather())) {
				return this.chainModify(2);
			}
		},
		onModifyAtk(atk, pokemon) {
			if (['sunnyday', 'desolateland'].includes(pokemon.effectiveWeather())) {
				return this.chainModify(1.5);
			}
		},
		onWeather(target, source, effect) {
			if (target.hasItem('utilityumbrella')) return;
			if (effect.id === 'sunnyday' || effect.id === 'desolateland') {
				this.damage(target.baseMaxhp / 8, target, target);
			}
		},
	},

	// n10siT
	greedymagician: {
		desc: "This Pokemon steals the item off a Pokemon it hits with an attack. If you already have an item, it is replaced with the stolen item. Does not affect Doom Desire and Future Sight.",
		shortDesc: "This Pokemon steals the item off a Pokemon it hits with an attack; existing item gets replaced with the stolen item.",
		name: "Greedy Magician",
		onSourceHit(target, source, move) {
			if (!move || !target) return;
			if (target !== source && move.category !== 'Status') {
				const yourItem = target.takeItem(source);
				if (!yourItem) return;
				if (!source.setItem(yourItem)) {
					target.item = yourItem.id;
					return;
				}
				this.add('-item', source, yourItem, '[from] ability: Greedy Magician', '[of] ' + target);
			}
		},
	},

	// Nolali
	burningsoul: {
		shortDesc: "Drought + Sturdy.",
		onStart(source) {
			this.field.setWeather('sunnyday');
		},
		onTryHit(pokemon, target, move) {
			if (move.ohko) {
				this.add('-immune', pokemon, '[from] ability: Burning Soul');
				return null;
			}
		},
		onDamagePriority: -100,
		onDamage(damage, target, source, effect) {
			if (target.hp === target.maxhp && damage >= target.hp && effect && effect.effectType === 'Move') {
				this.add('-ability', target, 'Burning Soul');
				return target.hp - 1;
			}
		},
		name: "Burning Soul",
	},

	// Overneat
	darkestwings: {
		desc: "This Pokemon's contact moves have their power multiplied by 1.3. This Pokemon's Defense is doubled.",
		shortDesc: "Contact moves are multiplied by 1.3. Defense is doubled.",
		name: "Darkest Wings",
		onBasePowerPriority: 21,
		onBasePower(basePower, attacker, defender, move) {
			if (move.flags['contact']) {
				return this.chainModify([0x14CD, 0x1000]);
			}
		},
		onModifyDefPriority: 6,
		onModifyDef(def) {
			return this.chainModify(2);
		},
	},

	// Perish Song
	soupsipper: {
		desc: "This Pokemon is immune to Water-type moves, restores 1/4 of its maximum HP, rounded down, when hit by a Water-type move, and boosts its Attack by 1 stage when hit by a Water-type move.",
		shortDesc: "Heals 1/4 of its max HP and gains +1 Atk when hit by Water moves; Water immunity.",
		onTryHit(target, source, move) {
			if (target !== source && move.type === 'Water') {
				if (!this.heal(target.baseMaxhp / 4) || !this.boost({atk: 1})) {
					this.add('-immune', target, '[from] ability: Soup Sipper');
				}
				return null;
			}
		},
		name: "Soup Sipper",
	},

	// phiwings99
	plausibledeniability: {
		desc: "This Pokemon's Status moves have priority raised by 1, but Dark types are immune. Additionally, This Pokemon ignores other Pokemon's Attack, Special Attack, and accuracy stat stages when taking damage, and ignores other Pokemon's Defense, Special Defense, and evasiveness stat stages when dealing damage.",
		shortDesc: "The effects of Unaware and Prankster combined. Dark types: immune to Prankster moves.",
		name: "Plausible Deniability",
		onAnyModifyBoost(boosts, pokemon) {
			const unawareUser = this.effectData.target;
			if (unawareUser === pokemon) return;
			if (unawareUser === this.activePokemon && pokemon === this.activeTarget) {
				boosts['def'] = 0;
				boosts['spd'] = 0;
				boosts['evasion'] = 0;
			}
			if (pokemon === this.activePokemon && unawareUser === this.activeTarget) {
				boosts['atk'] = 0;
				boosts['def'] = 0;
				boosts['spa'] = 0;
				boosts['accuracy'] = 0;
			}
		},
		onModifyPriority(priority, pokemon, target, move) {
			if (move?.category === 'Status') {
				move.pranksterBoosted = true;
				return priority + 1;
			}
		},
	},

	// PiraTe Princess
	wildmagicsurge: {
		desc: "Randomly changes the Pokemon's type at the end of every turn to the type of one of its moves; same-type attack bonus (STAB) is 2 instead of 1.5.",
		shortDesc: "Adaptability + Randomly changes the Pokemon’s type to the type of one of its moves every turn.",
		name: "Wild Magic Surge",
		onModifyMove(move) {
			move.stab = 2;
		},
		onResidual(pokemon) {
			if (!pokemon.hp) return;
			const moves = Object.values(pokemon.getMoves()).map(move => move.id);
			const types: string[] = [];
			for (const move of moves) {
				types.push(this.dex.getMove(move).type);
			}
			let type = this.sample(types);
			while (!pokemon.setType(type)) {
				type = this.sample(types);
			}
			this.add('-start', pokemon, 'typechange', type);
		},
	},

	// Robb576
	thenumbersgame: {
		desc: "Changes the pokemon's form upon switch-in depending on the amount of pokemon still alive on the user's team; Necrozma-Dusk-Mane if 3 or fewer, Necrozma-Ultra if it is the last Pokemon left on the team.",
		shortDesc: "Changes the pokemon's form upon switch-in depending on the amount of pokemon still alive on the user's team.",
		name: "The Numbers Game",
		onStart(target) {
			if (target.baseSpecies.baseSpecies !== 'Necrozma' || target.transformed) return;
			if (target.side.pokemonLeft <= 3) {
				if (target.species.name === 'Necrozma-Dusk-Mane' && target.side.pokemonLeft === 1 && target.m.flag2) {
					changeSet(this, target, ssbSets.Robb576Ultra);
				} else if (target.species.name === "Necrozma-Dawn-Wings" && target.m.flag1) {
					changeSet(this, target, ssbSets.Robb576DuskMane);
					target.m.flag2 = true;
				}
			}
			target.m.flag1 = true;
		},
	},

	// Segmr
	wallin: {
		desc: "When this Pokemon switches in, Aurora Veil automatically gets set up.",
		shortDesc: "Sets up Aurora Veil on switch-in.",
		name: "wAll In",
		onSwitchIn(pokemon) {
			if (pokemon.side.getSideCondition('auroraveil')) return;
			pokemon.side.addSideCondition('auroraveil');
		},
	},

	// Shadecession
	shadydeal: {
		desc: "on entering the battle, this mon gains a 1 stage boost to a random stat that isn't SpA and 2 random type immunities that are displayed to the opponent.",
		shortDesc: "on Switch in, oosts Random Stat other than SpA o.",
		onStart(pokemon) {
			this.add('-ability', pokemon, 'Shady Deal');
			const stats: BoostName[] = [];
			let stat: BoostName;
			for (stat in pokemon.boosts) {
				const noBoost: string[] = ['accuracy', 'evasion', 'spa'];
				if (!noBoost.includes(stat) && pokemon.boosts[stat] < 6) {
					stats.push(stat);
				}
			}
			if (stats.length) {
				const randomStat = this.sample(stats);
				const boost: SparseBoostsTable = {};
				boost[randomStat] = 1;
				this.boost(boost);
			}
			pokemon.addVolatile('shadydeal');
		},
		condition: {
			onStart(pokemon) {
				const typeList = Object.keys(this.dex.data.TypeChart);
				const firstTypeIndex = this.random(typeList.length);
				const secondType = this.sample(typeList.slice(0, firstTypeIndex).concat(typeList.slice(firstTypeIndex + 1)));
				this.effectData.immunities = [typeList[firstTypeIndex], secondType];
				this.add("-message", `Shadecession is now immune to ${this.effectData.immunities[0]} and ${this.effectData.immunities[1]} types!`);
			},
			onTryHit(target, source, move) {
				if (target !== source && this.effectData.immunities.includes(move.type)) {
					this.add('-immune', target, '[from] ability: Shady Deal');
					return null;
				}
			},
		},
		name: "Shady Deal",
	},

	// Struchni
	overaskedclause: {
		desc: "When switching in, become a random type that resists the last move the opponent used. If no move was used or if it's the first turn, pick a random type. If hit by a move that is not very effective, become Aggron-Mega (but keep the same type).",
		shortDesc: "I dont even know how to shortdesc this",
		name: "Overasked Clause",
		onSwitchIn(source) {
			const target = source.side.foe.active[0];
			if (!target || !target.lastMove) {
				const typeList = Object.keys(this.dex.data.TypeChart);
				const newType = this.sample(typeList);
				source.types = [newType];
				this.add('-start', source, 'typechange', newType);
				return;
			}
			const possibleTypes = [];
			const attackType = target.lastMove.type;
			for (const type in this.dex.data.TypeChart) {
				if (source.hasType(type)) continue;
				const typeCheck = this.dex.data.TypeChart[type].damageTaken[attackType];
				if (typeCheck === 2 || typeCheck === 3) {
					possibleTypes.push(type);
				}
			}
			if (!possibleTypes.length) {
				return false;
			}
			const randomType = this.sample(possibleTypes);

			if (!source.setType(randomType)) return false;
			this.add('-start', source, 'typechange', randomType);
		},
		onHit(target, source, move) {
			if (target.species.name !== 'Aggron' || target.illusion || target.transformed) return;
			if (!target.hp) return;
			if (target.getMoveHitData(move).typeMod < 0) {
				const sameType = target.types;
				this.runMegaEvo(target);
				target.setType(sameType);
				this.add('-start', target, 'typechange', sameType.join('/'));
			}
		},
	},

	// Sunny
	oneforall: {
		desc: "This Pokemon's contact moves have their power multiplied by 1.3. If this Pokemon KOes the target with a recoil move, it regains 25% of its max HP.",
		shortDesc: "Tough Claws + recovers 25% max HP when foe is KOed with a recoil move.",
		name: "One For All",
		onBasePowerPriority: 21,
		onBasePower(basePower, attacker, defender, move) {
			if (move.flags['contact']) {
				return this.chainModify([0x14CD, 0x1000]);
			}
		},
		onSourceAfterFaint(length, target, source, effect) {
			if (effect && effect.effectType === 'Move' && !!effect.recoil) this.heal(source.baseMaxhp / 4, source);
		},
	},

	// Tenshi
	royalcoat: {
		desc: "If Sandstorm is active, this Pokemon's Speed is doubled and its Special Defense is multiplied by 1.5. This Pokemon takes no damage from Sandstorm.",
		shortDesc: "If Sandstorm, Speed x2 and SpD x1.5; immunity to Sandstorm.",
		name: "Royal Coat",
		onModifySpe(spe, pokemon) {
			if (this.field.isWeather('sandstorm')) {
				return this.chainModify(2);
			}
		},
		onModifySpD(spd, pokemon) {
			if (this.field.isWeather('sandstorm')) {
				return this.chainModify(1.5);
			}
		},
		onImmunity(type, pokemon) {
			if (type === 'sandstorm') return false;
		},
	},

	// tiki
	truegrit: {
		desc: "This Pokemon receives 1/2 damage from special attacks. This Pokemon ignores other Pokemon's Attack, Special Attack, and accuracy stat stages when taking damage, and ignores other Pokemon's Defense, Special Defense, and evasiveness stat stages when dealing damage.",
		shortDesc: "Takes 1/2 damage from special moves and ignores boosts.",
		name: "True Grit",
		onSourceModifyDamage(damage, source, target, move) {
			if (move.category === 'Special') {
				return this.chainModify(0.5);
			}
		},
		onAnyModifyBoost(boosts, pokemon) {
			const unawareUser = this.effectData.target;
			if (unawareUser === pokemon) return;
			if (unawareUser === this.activePokemon && pokemon === this.activeTarget) {
				boosts['def'] = 0;
				boosts['spd'] = 0;
				boosts['evasion'] = 0;
			}
			if (pokemon === this.activePokemon && unawareUser === this.activeTarget) {
				boosts['atk'] = 0;
				boosts['def'] = 0;
				boosts['spa'] = 0;
				boosts['accuracy'] = 0;
			}
		},
	},

	// Trickster
	trillionageroots: {
		desc: "Sturdy + seeds the opposing Pokemon when hit with an attacking move.",
		shortDesc: "Sturdy + seeds the opposing Pokemon when hit with an attacking move.",
		onTryHit(pokemon, target, move) {
			if (move.ohko) {
				this.add('-immune', pokemon, '[from] ability: Trillionage Roots');
				return null;
			}
		},
		onDamagePriority: -100,
		onDamage(damage, target, source, effect) {
			if (target.hp === target.maxhp && damage >= target.hp && effect && effect.effectType === 'Move') {
				this.add('-ability', target, 'Trillionage Roots');
				return target.hp - 1;
			}
		},
		onDamagingHit(damage, target, source, move) {
			if (source.volatiles['leechseed']) return;
			if (!move.isFutureMove) {
				source.addVolatile('leechseed', this.effectData.target);
			}
		},
		name: "Trillionage Roots",
	},

	// vooper
	qigong: {
		shortDesc: "This Pokemon's Defense is doubled, and it receives 1/2 damage from special attacks.",
		onModifyDefPriority: 6,
		onModifyDef(def) {
			return this.chainModify(2);
		},
		onSourceModifyDamage(damage, source, target, move) {
			if (move.category === 'Special') {
				return this.chainModify(0.5);
			}
		},
		name: "Qi-Gong",
	},

	// yuki
	combattraining: {
		desc: "If this Pokemon is a Cosplay Pikachu forme, the first hit it takes in battle deals 0 neutral damage. Confusion damage also breaks the immunity.",
		shortDesc: "(Pikachu-Cosplay only) First hit deals 0 damage.",
		onDamagePriority: 1,
		onDamage(damage, target, source, effect) {
			const cosplayFormes = [
				'pikachucosplay', 'pikachuphd', 'pikachulibre', 'pikachupopstar', 'pikachurockstar', 'pikachubelle',
			];
			if (
				effect?.effectType === 'Move' &&
				cosplayFormes.includes(target.species.id) && !target.transformed &&
				!this.effectData.busted
			) {
				this.add('-activate', target, 'ability: Combat Training');
				this.effectData.busted = true;
				return 0;
			}
		},
		onCriticalHit(target, source, move) {
			if (!target) return;
			const cosplayFormes = [
				'pikachucosplay', 'pikachuphd', 'pikachulibre', 'pikachupopstar', 'pikachurockstar', 'pikachubelle',
			];
			if (!cosplayFormes.includes(target.species.id) || target.transformed) {
				return;
			}
			const hitSub = target.volatiles['substitute'] && !move.flags['authentic'] && !(move.infiltrates && this.gen >= 6);
			if (hitSub) return;

			if (!target.runImmunity(move.type)) return;
			return false;
		},
		onEffectiveness(typeMod, target, type, move) {
			if (!target) return;
			const cosplayFormes = [
				'pikachucosplay', 'pikachuphd', 'pikachulibre', 'pikachupopstar', 'pikachurockstar', 'pikachubelle',
			];
			if (!cosplayFormes.includes(target.species.id) || target.transformed) {
				return;
			}
			const hitSub = target.volatiles['substitute'] && !move.flags['authentic'] && !(move.infiltrates && this.gen >= 6);
			if (hitSub) return;

			if (!target.runImmunity(move.type)) return;
			return 0;
		},
		name: "Combat Training",
	},
	// Modified Illusion to support SSB volatiles
	illusion: {
		inherit: true,
		onEnd(pokemon) {
			if (pokemon.illusion) {
				this.debug('illusion cleared');
				let disguisedAs = this.toID(pokemon.illusion.name);
				pokemon.illusion = null;
				const details = pokemon.species.name + (pokemon.level === 100 ? '' : ', L' + pokemon.level) +
					(pokemon.gender === '' ? '' : ', ' + pokemon.gender) + (pokemon.set.shiny ? ', shiny' : '');
				this.add('replace', pokemon, details);
				this.add('-end', pokemon, 'Illusion');
				// Handle users whos names match a species
				if (this.dex.getSpecies(disguisedAs).exists) disguisedAs += 'user';
				if (pokemon.volatiles[disguisedAs]) {
					pokemon.removeVolatile(disguisedAs);
				}
				if (!pokemon.volatiles[this.toID(pokemon.name)]) {
					const status = this.dex.getEffect(this.toID(pokemon.name));
					if (status?.exists) {
						pokemon.addVolatile(this.toID(pokemon.name), pokemon);
					}
				}
			}
		},
	},

	// Modified various abilities to support Alpha's move
	deltastream: {
		inherit: true,
		desc: "On switch-in, the weather becomes strong winds that remove the weaknesses of the Flying type from Flying-type Pokemon. This weather remains in effect until this Ability is no longer active for any Pokemon, or the weather is changed by Desolate Land, Heavy Hailstorm, or Primordial Sea.",
		shortDesc: "On switch-in, strong winds begin until this Ability is not active in battle.",
		onAnySetWeather(target, source, weather) {
			const strongWeathers = ['desolateland', 'primordialsea', 'deltastream', 'heavyhailstorm'];
			if (this.field.getWeather().id === 'deltastream' && !strongWeathers.includes(weather.id)) return false;
		},
	},
	desolateland: {
		inherit: true,
		desc: "On switch-in, the weather becomes extremely harsh sunlight that prevents damaging Water-type moves from executing, in addition to all the effects of Sunny Day. This weather remains in effect until this Ability is no longer active for any Pokemon, or the weather is changed by Delta Stream, Heavy Hailstorm, or Primordial Sea.",
		shortDesc: "On switch-in, extremely harsh sunlight begins until this Ability is not active in battle.",
		onAnySetWeather(target, source, weather) {
			const strongWeathers = ['desolateland', 'primordialsea', 'deltastream', 'heavyhailstorm'];
			if (this.field.getWeather().id === 'desolateland' && !strongWeathers.includes(weather.id)) return false;
		},
	},
	forecast: {
		inherit: true,
		onUpdate(pokemon) {
			if (pokemon.baseSpecies.baseSpecies !== 'Castform' || pokemon.transformed) return;
			let forme = null;
			switch (pokemon.effectiveWeather()) {
			case 'sunnyday':
			case 'desolateland':
				if (pokemon.species.id !== 'castformsunny') forme = 'Castform-Sunny';
				break;
			case 'raindance':
			case 'primordialsea':
				if (pokemon.species.id !== 'castformrainy') forme = 'Castform-Rainy';
				break;
			case 'heavyhailstorm':
			case 'hail':
				if (pokemon.species.id !== 'castformsnowy') forme = 'Castform-Snowy';
				break;
			default:
				if (pokemon.species.id !== 'castform') forme = 'Castform';
				break;
			}
			if (pokemon.isActive && forme) {
				pokemon.formeChange(forme, this.effect, false, '[msg]');
			}
		},
	},
	icebody: {
		inherit: true,
		desc: "If Hail or Heavy Hailstorm is active, this Pokemon restores 1/16 of its maximum HP, rounded down, at the end of each turn. This Pokemon takes no damage from Hail or Heavy Hailstorm.",
		shortDesc: "Hail-like weather active: heals 1/16 max HP each turn; immunity to Hail-like weather.",
		onWeather(target, source, effect) {
			if (['heavyhailstorm', 'hail'].includes(effect.id)) {
				this.heal(target.baseMaxhp / 16);
			}
		},
		onImmunity(type, pokemon) {
			if (['heavyhailstorm', 'hail'].includes(type)) return false;
		},
	},
	iceface: {
		inherit: true,
		desc: "If this Pokemon is an Eiscue, the first physical hit it takes in battle deals 0 neutral damage. Its ice face is then broken and it changes forme to Noice Face. Eiscue regains its Ice Face forme when Hail or Heavy Hailstorm begins or when Eiscue switches in while Hail or Heavy Hailstorm is active. Confusion damage also breaks the ice face.",
		shortDesc: "If Eiscue, first physical hit taken deals 0 damage. Effect is restored in Hail-like weather.",
		onStart(pokemon) {
			if (this.field.isWeather(['heavyhailstorm', 'hail']) &&
				pokemon.species.id === 'eiscuenoice' && !pokemon.transformed) {
				this.add('-activate', pokemon, 'ability: Ice Face');
				this.effectData.busted = false;
				pokemon.formeChange('Eiscue', this.effect, true);
			}
		},
		onAnyWeatherStart() {
			const pokemon = this.effectData.target;
			if (this.field.isWeather(['heavyhailstorm', 'hail']) &&
				pokemon.species.id === 'eiscuenoice' && !pokemon.transformed) {
				this.add('-activate', pokemon, 'ability: Ice Face');
				this.effectData.busted = false;
				pokemon.formeChange('Eiscue', this.effect, true);
			}
		},
	},
	primordialsea: {
		inherit: true,
		desc: "On switch-in, the weather becomes heavy rain that prevents damaging Fire-type moves from executing, in addition to all the effects of Rain Dance. This weather remains in effect until this Ability is no longer active for any Pokemon, or the weather is changed by Delta Stream, Desolate Land, or Heavy Hailstorm.",
		shortDesc: "On switch-in, heavy rain begins until this Ability is not active in battle.",
		onStart(source) {
			this.field.setWeather('primordialsea');
		},
		onAnySetWeather(target, source, weather) {
			const strongWeathers = ['desolateland', 'primordialsea', 'deltastream', 'heavyhailstorm'];
			if (this.field.getWeather().id === 'primordialsea' && !strongWeathers.includes(weather.id)) return false;
		},
	},
	slushrush: {
		inherit: true,
		shortDesc: "If a Hail-like weather is active, this Pokemon's Speed is doubled.",
		onModifySpe(spe, pokemon) {
			if (this.field.isWeather(['heavyhailstorm', 'hail'])) {
				return this.chainModify(2);
			}
		},
	},
	snowcloak: {
		inherit: true,
		desc: "If Heavy Hailstorm or Hail is active, this Pokemon's evasiveness is multiplied by 1.25. This Pokemon takes no damage from Heavy Hailstorm or Hail.",
		shortDesc: "If a Hail-like weather is active, 1.25x evasion; immunity to Hail-like weathers.",
		onImmunity(type, pokemon) {
			if (['heavyhailstorm', 'hail'].includes(type)) return false;
		},
		onModifyAccuracy(accuracy) {
			if (typeof accuracy !== 'number') return;
			if (this.field.isWeather(['heavyhailstorm', 'hail'])) {
				this.debug('Snow Cloak - decreasing accuracy');
				return accuracy * 0.8;
			}
		},
	},
	// Modified Magic Guard for Alpha
	magicguard: {
		inherit: true,
		shortDesc: "This Pokemon can only be damaged by direct attacks and Heavy Hailstorm.",
		onDamage(damage, target, source, effect) {
			if (effect.id === 'heavyhailstorm') return;
			if (effect.effectType !== 'Move') {
				if (effect.effectType === 'Ability') this.add('-activate', source, 'ability: ' + effect.name);
				return false;
			}
		},
	},
};
