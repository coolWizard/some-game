import { Vector3, } from 'three';
import localStorage from 'store';

import { getCameraDistanceToPlayer } from 'helpers/Utils';

import {
    setUpPhysics, createWorld, tearDownWorld,
} from 'physics-utils';

// todo: move these to config file?
const defaultPlayerRadius = 0.45;
const defaultPlayerDensity = 1000; // kg / m^3
const defaultPushyDensity = 750; // kg / m^3
const cameraFov = 75;

const SET_GAME_INITIAL_PHYSICS_STATE = 'game/SET_GAME_INITIAL_PHYSICS_STATE';
const GAME_SELECT_CHAPTER = 'game/GAME_SELECT_CHAPTER';
const GAME_SELECT_PREVIOUS_CHAPTER = 'game/GAME_SELECT_PREVIOUS_CHAPTER';
const START_GAME = 'game/START_GAME';
const REMOVE_ENTITY = 'game/REMOVE_ENTITY';
const SET_RUNNING_GAME_STATE = 'game/SET_RUNNING_GAME_STATE';
const UPDATE_RUNNING_GAME_STATE = 'game/UPDATE_RUNNING_GAME_STATE';
const STOP_GAME = 'game/STOP_GAME';
const RESTART_CHAPTER = 'game/RESTART_CHAPTER';
const RESTART_BOOK = 'game/RESTART_BOOK';
const SCALE_PLAYER = 'game/SCALE_PLAYER';
const QUEUE_BEGIN_CONTACT_EVENT = 'game/QUEUE_BEGIN_CONTACT_EVENT';
const QUEUE_END_CONTACT_EVENT = 'game/QUEUE_END_CONTACT_EVENT';

// Find the player entity for this chapter to use the starting point, or
// default to the middle
function findPlayerPosition(
    levels:Object,
    chapters:Object,
    entities:Object,
    chapterId:any
) {

    return ( ( levels[ chapters[ chapterId ].levelId ].entityIds
        .map( id => entities[ id ] )
        .find( entity => entity.type === 'player' ) || {}
    ).position || new Vector3( 0, 1.5, 0 ) ).clone();

}

function convertOriginalLevelsToGameLevels(
    levels:Object,
    entities:Object,
) {

    // Remove player entities from each level
    return Object.keys( levels ).reduce( ( memo, id ) => {

        const level = levels[ id ];
        return {
            ...memo,
            [ id ]: {
                ...level,
                entityIds: level.entityIds.filter(
                    eId => entities[ eId ].type !== 'player'
                )
            }
        };

    }, {} );

}

function convertOriginalEntitiesToGameEntities( originalEntities:Object ) {

    return Object.keys( originalEntities ).reduce( ( memo, id ) => {

        const entity = originalEntities[ id ];
        if( entity.type !== 'player' ) {

            memo[ id ] = {
                ...entity,
                position: entity.position.clone(),
                scale: entity.scale.clone(),
                rotation: entity.rotation.clone(),
            };

        }

        return memo;

    }, {} );

}

const initialGameReducerState = {
    // Note that GameContainer requires this to be null instead of false to not
    // recreate the physics
    physicsInitted: null,
    playerRadius: defaultPlayerRadius,
    playerDensity: defaultPlayerDensity,
    pushyDensity: defaultPushyDensity,
    playerScale: 1,
    entities: {},
    levels: {}
};

export function game( state = initialGameReducerState, action = {} ) {

    const {
        playerPosition, originalEntities, originalLevels, chapters, books,
        recursionBusterId, restartBusterId, chapterId
    } = action;

    switch( action.type ) {

        case RESTART_BOOK:
        case RESTART_CHAPTER:
        case START_GAME:

            return {
                ...state,
                playerPosition, chapters, books,
                playerMaterialId: 'glowTextureFace',

                // Reset scale and radius because if level is restarted while
                // small, scale will be wrong
                playerScale: initialGameReducerState.playerScale,
                playerRadius: initialGameReducerState.playerRadius,

                restartBusterId: restartBusterId || state.restartBusterId,
                recursionBusterId: recursionBusterId || state.recursionBusterId,

                // TODO: Create these in the action creators instead?
                levels: convertOriginalLevelsToGameLevels( originalLevels, originalEntities ),
                entities: convertOriginalEntitiesToGameEntities( originalEntities ),

                gameState: {
                    moveQueue: [],
                    textQueue: [],
                    sideEffectQueue: [],
                    cameraPosition: new Vector3(
                        playerPosition.x,
                        getCameraDistanceToPlayer( playerPosition.y, cameraFov, 1 ),
                        playerPosition.z,
                    ),
                    world: action.world,
                    beginContactEventQueue: [],
                    endContactEventQueue: [],
                },

                cameraFov,

                physicsInitted: false,
                started: true,

            };

        case SET_GAME_INITIAL_PHYSICS_STATE:
            return {
                ...state,
                physicsInitted: true,
                gameState: {
                    ...state.gameState,
                    ...action.initialPhysicsGameState,
                }
            };

        // todo: put these in a sub reducer? or take out of gameState and pass
        // as props. Keep in mind contactEventReducer clears
        case QUEUE_BEGIN_CONTACT_EVENT:
            return {
                ...state,
                gameState: {
                    ...state.gameState,
                    beginContactEventQueue: [
                        ...state.gameState.beginContactEventQueue,
                        action.event
                    ],
                }
            };
        
        case QUEUE_END_CONTACT_EVENT:
            return {
                ...state,
                gameState: {
                    ...state.gameState,
                    endContactEventQueue: [
                        ...state.gameState.endContactEventQueue,
                        action.event
                    ],
                }
            };

        case SET_RUNNING_GAME_STATE:
            return {
                ...state,
                gameState: action.newGameState,
            };

        case UPDATE_RUNNING_GAME_STATE:
            return {
                ...state,
                gameState: {
                    ...state.gameState,
                    ...action.newGameState,
                }
            };

        case GAME_SELECT_PREVIOUS_CHAPTER:
        case GAME_SELECT_CHAPTER:
            return {
                ...state,
                recursionBusterId: action.recursionBusterId,
                playerRadius: state.playerRadius * ( action.isNextChapterBigger ? 0.125 : 8 ),
                playerScale: state.playerScale * ( action.isNextChapterBigger ? 0.125 : 8 ),
            };

        case SCALE_PLAYER:

            const level = state.levels[ action.levelId ];

            return {
                ...state,
                playerMaterialId: 'glowTextureFace',
                playerRadius: state.playerRadius * action.multiplier,
                playerScale: state.playerScale * action.multiplier,
                levels: {
                    ...state.levels,
                    [ level.id ]: {
                        ...level,
                        entityIds: level.entityIds.filter( id => id !== action.powerupIdToRemove )
                    }
                }
            };

        case REMOVE_ENTITY:

            const removeLevel = state.levels[ action.levelId ];

            return {
                ...state,
                levels: {
                    ...state.levels,
                    [ removeLevel.id ]: {
                        ...removeLevel,
                        entityIds: removeLevel.entityIds.filter( id => id !== action.entityId )
                    }
                }
            };

        case STOP_GAME:
            return initialGameReducerState;

        default:
            return state;

    }

}

const defaultChapterState = {};
export function gameChapterReducer( state = defaultChapterState, action = {} ) {

    switch( action.type ) {

        case RESTART_BOOK:
        case START_GAME:
            return {
                previousChapterId: action.previousChapterId,
                currentChapterId: action.chapterId,
                previousChapterNextChapter: action.nextChapter,
            };

        case GAME_SELECT_PREVIOUS_CHAPTER:
            return {
                ...state,
                currentChapterId: action.chapterId,
                // We're going backwards, so we can't use
                // state.currentChapterId, because GameContainer uses that to
                // calculate the previous level to show
                previousChapterId: action.previousChapterId,
                previousChapterNextChapter: action.nextChapter,
            };

        case GAME_SELECT_CHAPTER:
            return {
                ...state,
                previousChapterId: action.previousChapterId,
                currentChapterId: action.chapterId,
                previousChapterNextChapter: action.nextChapter,
            };

        case STOP_GAME:
            return defaultChapterState;

        default:
            return state;

    }

}

const defaultBookState = null;
export function gameBookReducer( state = defaultBookState, action = {} ) {

    switch( action.type ) {

        case START_GAME:
            return action.bookId;

        case STOP_GAME:
            return defaultBookState;

        default:
            return state;

    }

}

export function setGameState( newGameState:Object ) {
    return {
        type: SET_RUNNING_GAME_STATE,
        newGameState,
    };
}

export function updateGameState( newGameState:Object ) {
    return {
        type: UPDATE_RUNNING_GAME_STATE,
        newGameState,
    };
}

export function startGame(
    actions:Object,
    bookId:any,
    chapterId:any,
    previousChapterId:any,
    nextChapter:any,
    originalLevels:Object,
    originalEntities:Object,
    books:Object,
    chapters:Object,
    recursionBusterId:any,
) {

    const world = createWorld( actions );

    const playerPosition = findPlayerPosition(
        originalLevels, chapters, originalEntities, chapterId
    );

    return {
        type: START_GAME,
        restartBuesterId: Date.now(),
        world, playerPosition, bookId, chapterId, previousChapterId,
        nextChapter, originalLevels, originalEntities, chapters, books,
        recursionBusterId,
    };
}

export function stopGame( world:Object ) {

    tearDownWorld( world );
    return { type: STOP_GAME, };

}

export function restartChapter(
    actions:Object,
    bookId:any,
    chapterId:any,
    originalEntities:Object,
    originalLevels:Object,
    chapters:Object,
    books:Object,
    oldWorld:Object,
) {

    // duplicated from stopGame and startGame() but cleanest path I can think
    // of for now for restarting
    tearDownWorld( oldWorld );

    const world = createWorld( actions );

    const playerPosition = findPlayerPosition(
        originalLevels, chapters, originalEntities, chapterId
    );

    return {
        type: RESTART_CHAPTER,
        restartBusterId: Date.now(),
        world, playerPosition, bookId, chapterId, originalLevels,
        originalEntities, books, chapters,
    };

}

export function restartBook(
    actions:Object,
    bookId:any,
    chapterId:any,
    previousChapterId:any,
    originalLevels:Object,
    originalEntities:Object,
    books:Object,
    chapters:Object,
    recursionBusterId:any,
    oldWorld:Object,
) {

    tearDownWorld( oldWorld );

    const world = createWorld( actions );

    const playerPosition = findPlayerPosition(
        originalLevels, chapters, originalEntities, chapterId
    );

    const bookData = localStorage.get( bookId ) || {};
    bookData.chapterId = chapterId;
    bookData.previousChapterId = null;

    localStorage.set( bookId, bookData );

    return {
        type: RESTART_BOOK,
        restartBusterId: Date.now(),
        world, playerPosition, bookId, chapterId, originalLevels,
        originalEntities, books, chapters,
    };

}

export function createPhysicsBodies(
    playerPosition2D:Array,
    world:Object,
    books:Object,
    chapters:Object,
    playerRadius:number,
    playerDensity:number,
    pushyDensity:number,
    currentLevelStaticEntitiesArray:Array,
    currentLevelMovableEntitiesArray:Array,
    currentLevelBridgesArray:Array,
) {

    const initialPhysicsGameState = setUpPhysics(
        world, playerPosition2D, playerRadius, playerDensity,
        pushyDensity, currentLevelStaticEntitiesArray,
        currentLevelMovableEntitiesArray, currentLevelBridgesArray,
    );

    return {
        type: SET_GAME_INITIAL_PHYSICS_STATE,
        initialPhysicsGameState,
    };

}

export function advanceChapter(
    currentBookId:any,
    currentChapterId:any,
    nextChapter:Object
) {

    const bookData = localStorage.get( currentBookId ) || {};
    bookData.chapterId = nextChapter.chapterId;
    bookData.previousChapterId = currentChapterId;

    localStorage.set( currentBookId, bookData );

    return {
        type: GAME_SELECT_CHAPTER,
        recursionBusterId: Date.now(),
        previousChapterId: currentChapterId,
        chapterId: nextChapter.chapterId,
        isNextChapterBigger: nextChapter.scale.x > 1,
        nextChapter,
    };
}

// Going back to the first chapter, there won't be previousChapterNextChapter
// data
export function advanceToPreviousChapter(
    nextChapter:Object,
    bookId:any,
    chapterId:any,
    previousChapterId:any,
    isNextChapterBigger:boolean
) {

    const bookData = localStorage.get( bookId ) || {};
    bookData.chapterId = nextChapter.chapterId;
    bookData.previousChapterId = previousChapterId;

    localStorage.set( bookId, bookData );

    return {
        type: GAME_SELECT_PREVIOUS_CHAPTER,
        recursionBusterId: Date.now(),
        chapterId, isNextChapterBigger, previousChapterId, nextChapter,
    };
}

// Update all the player data props like radius, and remove the entity we
// collected from the current level.
export function scalePlayer(
    levelId:string,
    powerupIdToRemove:any,
    multiplier:any
) {
    return {
        type: SCALE_PLAYER,
        levelId, powerupIdToRemove, multiplier
    };
}

export function removeEntity( levelId:string, entityId:any, ) {
    return {
        type: REMOVE_ENTITY,
        levelId, entityId
    };
}


export function queueBeginContactEvent( event:Object ) {
    return {
        type: QUEUE_BEGIN_CONTACT_EVENT,
        event,
    };
}

export function queueEndContactEvent( event:Object ) {
    return {
        type: QUEUE_END_CONTACT_EVENT,
        event,
    };
}
