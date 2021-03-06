import React, { Component, PropTypes } from 'react';
import THREE, { Vector3, } from 'three';
import p2 from 'p2';
import { connect } from 'react-redux';
import { asyncConnect } from 'redux-async-connect';
import { bindActionCreators } from 'redux';
import { createSelector } from 'reselect';
import { Kbd } from 'components';
import KeyHandler from 'helpers/KeyHandler';

import styles from './Game.scss';
import classNames from 'classnames/bind';
const cx = classNames.bind( styles );

import { emptyWorld, } from 'physics-utils';

import { loadAllAssets, } from 'redux/modules/assets';
import {
    scalePlayer, advanceToPreviousChapter, advanceChapter, startGame, stopGame,
    restartChapter, restartBook, queueBeginContactEvent, queueEndContactEvent,
    createPhysicsBodies, removeEntity,
} from 'redux/modules/game';
import {
    areBooksLoaded, loadAllBooks, deserializeLevels
} from 'redux/modules/editor';

import {
    getSphereMass, applyMiddleware, getCameraDistanceToPlayer, v3toP2,
} from 'helpers/Utils';

import { setGameState, updateGameState, } from 'redux/modules/game';

import {
    pauseGame, unpauseGame, showConfirmMenuScreen, exitToMenuDeny,
    showConfirmRestartScreen, confirmRestart, denyRestart,
    showConfirmRestartBookMenuScreen, confirmRestartBook, denyRestartBook,
} from 'redux/modules/gameScreen';

import {
    playerPositionReducer, gameKeyPressReducer, tourReducer, zoomReducer,
    entityInteractionReducer, playerScaleReducer, debugReducer,
    advanceLevelReducer, defaultCameraReducer, playerAnimationReducer,
    speechReducer, contactEventReducer, physicsReducer, gameScreenReducer,
    outOfBoundsReducer, translateEntityReducer,
} from 'game-middleware';

import GameGUI from './GameGUI';

// State selectors for createSelector memoization
const getAllEntities = state => state.game.entities;
const getAllChapters = state => state.chapters;
const getLevels = state => state.game.levels;
const getGameStarted = state => state.game.started;
const getBooks = state => state.books;
const getActiveChapters = state => state.game.chapters;
const getPlayerMaterialId = state => state.game.playerMaterialId;
const getGameChapterData = state => state.gameChapterData;
const getOriginalLevels = state => state.levels;
const getOriginalEntities = state => state.entities;
const getAssets = state => state.assets;
const getFonts = state => state.fonts;
const getLetters = state => state.letters;
const getRestartBusterId = state => state.game.restartBusterId;
const getRecursionBusterId = state => state.game.recursionBusterId;
const getPlayerPosition = state => state.game.playerPosition;
const getPlayerRadius = state => state.game.playerRadius;
const getPlayerScale = state => state.game.playerScale;
const getPlayerDensity = state => state.game.playerDensity;
const getPushyDensity = state => state.game.pushyDensity;

const gameDataSelector = createSelector(
    [
        getGameStarted, getAllEntities, getAllChapters, getLevels, getBooks,
        getActiveChapters, getPlayerMaterialId, getGameChapterData,
        getOriginalLevels, getOriginalEntities, getAssets, getFonts,
        getLetters, getRestartBusterId, getRecursionBusterId,
        getPlayerPosition, getPlayerRadius, getPlayerScale, getPlayerDensity,
        getPushyDensity,
    ],
    (
        gameStarted, allEntities, allChapters, levels, books, activeChapters,
        playerMaterialId, gameChapterData, originalLevels, originalEntities,
        assets, fonts, letters, restartBusterId, recursionBusterId,
        playerPosition, playerRadius, playerScale, playerDensity, pushyDensity,
    ) => {

        // No game has been started yet!
        if( !gameChapterData.currentChapterId ) {

            return {
                chapters: allChapters,
                books, originalLevels, originalEntities, fonts,
                letters, assets,
            };

        }

        const {
            previousChapterId, currentChapterId, previousChapterNextChapter
        } = gameChapterData;

        // Levels and entities
        const currentChapter = allChapters[ currentChapterId ];
        const { levelId: currentLevelId } = currentChapter;
        const currentLevel = levels[ currentLevelId ];

        const {
            currentLevelAllEntities,
            currentLevelStaticEntities,
            currentLevelRenderableEntities,
            currentLevelMovableEntities,
            currentLevelTouchyArray,
            currentLevelBridges,
        } = currentLevel.entityIds.reduce( ( memo, id ) => {

            const entity = allEntities[ id ];
            memo.currentLevelAllEntities[ id ] = entity;

            if( entity.type === 'trigger' || entity.type === 'shrink' || entity.type === 'grow' || entity.type === 'finish' ) {
                memo.currentLevelTouchyArray = [
                    ...memo.currentLevelTouchyArray, entity
                ];
                // needs to go into static to render
                memo.currentLevelRenderableEntities[ id ] = entity;
            } else if( entity.movable === true ) {
                memo.currentLevelMovableEntities[ id ] = entity;
            // Things like waterfalls with no physical geometry
            } else if( entity.type === 'waterfall' || entity.type === 'puffer' ) {
                memo.currentLevelRenderableEntities[ id ] = entity;
            // bridges?
            } else if( entity.type === 'bridge' ) {
                memo.currentLevelBridges[ id ] = entity;
                memo.currentLevelRenderableEntities[ id ] = entity;
            // walls, floors, etc
            } else {

                if( entity.touchable !== false ) {
                    memo.currentLevelStaticEntities[ id ] = entity;
                }

                if( entity.visible !== false ) {
                    memo.currentLevelRenderableEntities[ id ] = entity;
                }
            }

            return memo;

        }, {
            currentLevelBridges: {},
            currentLevelRenderableEntities: {},
            currentLevelMovableEntities: {},
            currentLevelAllEntities: {},
            currentLevelStaticEntities: {},
            currentLevelTouchyArray: [],
        });

        // Books and chapters
        let previousChapterEntities;
        let previousChapterEntity;
        let previousChapterFinishData;
        let previousChapterFinishEntity;
        let previousChapter;

        const nextChapters = currentChapter.nextChapters;

        if( previousChapterId ) {

            previousChapter = allChapters[ previousChapterId ];

            const previousLevel = levels[ previousChapter.levelId ];
            previousChapterEntities = previousLevel.entityIds.map(
                id => allEntities[ id ]
            );

            const { position, scale, } = previousChapterNextChapter;
            const isCurrentChapterBiggerThanPreviousChapter = scale.x > 1; // false
            const multiplier = isCurrentChapterBiggerThanPreviousChapter ? 0.125 : 8; // 8 multiply all previous chatper by 8

            previousChapterEntity = {
                scale: new Vector3(
                    multiplier, multiplier, multiplier
                ),
                position: position
                    .clone()
                    .multiply(
                        new Vector3( -multiplier, multiplier, -multiplier )
                    )
                    .setY( isCurrentChapterBiggerThanPreviousChapter ? 0.875 : -7 )
            };

            previousChapterFinishData = previousLevel.entityIds
                .map( id => allEntities[ id ] )
                .find( entity => entity.type === 'finish' );

            previousChapterFinishEntity = {
                ...previousChapterFinishData,
                scale: previousChapterFinishData.scale
                    .clone()
                    .multiplyScalar( multiplier ),
                position: previousChapterFinishData.position
                    .clone()
                    .sub( position )
                    .multiplyScalar( multiplier )
            };

            currentLevelTouchyArray.push( previousChapterFinishEntity );

        }

        // Index all next chapter entities by chapter id
        let nextChaptersEntities;
        if( nextChapters ) {

            nextChaptersEntities = nextChapters.reduce(
                ( memo, nextChapter ) => ({
                    ...memo,
                    [ nextChapter.chapterId ]: levels[
                            allChapters[ nextChapter.chapterId ].levelId
                        ].entityIds.map( id => allEntities[ id ] )
                }),
                {}
            );

        }

        return {
            levels, currentLevel, currentLevelId, currentChapterId,
            currentLevelAllEntities, currentLevelStaticEntities, allEntities,
            nextChaptersEntities, assets, fonts, letters, originalLevels,
            originalEntities, books, gameStarted,
            currentLevelStaticEntitiesArray: Object.values( currentLevelStaticEntities ),
            currentLevelTouchyArray, nextChapters, previousChapterEntities,
            previousChapterId, previousChapterFinishEntity,
            previousChapterEntity, previousChapter, previousChapterNextChapter,
            currentLevelMovableEntities,
            currentLevelMovableEntitiesArray: Object.values( currentLevelMovableEntities ),
            currentLevelRenderableEntities,
            currentLevelRenderableEntitiesArray: Object.values( currentLevelRenderableEntities ),
            currentLevelBridges, allChapters,
            currentLevelBridgesArray: Object.values( currentLevelBridges ),
            allChaptersArray: Object.values( allChapters ),

            playerMaterialId,
            chapters: activeChapters,
            restartBusterId: restartBusterId,
            recursionBusterId: recursionBusterId,
            playerPosition, playerRadius, playerScale, playerDensity,
            pushyDensity,
            playerMass: getSphereMass( playerDensity, playerRadius )
        };

    }
);

// Determines server and client side rendering and calling initial data loading
@asyncConnect([{
    promise: ({ store: { dispatch, getState } }) => {
        const promises = [];
        if( !areBooksLoaded( getState() ) ) {
            promises.push( dispatch( loadAllBooks() ) );
        }
        return Promise.all( promises );
    }
}])
@connect(
    state => ({
        assetsLoaded: state.assetsLoaded,
        assetsLoading: state.assetsLoading,
        fonts: state.fonts,
        assets: state.assets,
        gameState: state.game.gameState,
        cameraFov: state.game.cameraFov,
        physicsInitted: state.game.physicsInitted,
        paused: state.gameScreen.paused,
        confirmingRestart: state.gameScreen.confirmingRestart,
        confirmingRestartBook: state.gameScreen.confirmingRestartBook,
        currentBookId: state.currentGameBook,
        confirmingMenu: state.gameScreen.confirmingMenu,
        ...gameDataSelector( state ),
    }),
    dispatch => bindActionCreators({
        loadAllAssets, deserializeLevels, scalePlayer,
        advanceToPreviousChapter, advanceChapter, startGame, stopGame,
        restartChapter, restartBook, pauseGame, unpauseGame,
        showConfirmMenuScreen, exitToMenuDeny, showConfirmRestartScreen,
        showConfirmRestartBookMenuScreen,
        confirmRestartBook, denyRestartBook, confirmRestart, denyRestart,
        setGameState, updateGameState, queueBeginContactEvent,
        queueEndContactEvent, createPhysicsBodies, removeEntity,
    }, dispatch )
)
export default class GameContainer extends Component {

    static contextTypes = {
        store: PropTypes.object.isRequired
    }

    constructor() {

        super();
        this.gameLoop = this.gameLoop.bind( this );
        this.startGameLoop = this.startGameLoop.bind( this );
        this.stopGameLoop = this.stopGameLoop.bind( this );

        this.state = {
            gameWidth: 600,
            gameHeight: 600,
        };

    }

    componentDidMount() {

        this.mounted = true;

        const {
            assetsLoaded, assetsLoading,
            deserializeLevels: deserialize,
            loadAllAssets: loadAll,
        } = this.props;

        window.THREE = THREE;
        window.p2 = p2;

        if( !assetsLoaded && !assetsLoading ) {
            deserialize();
            loadAll();
        }

        this.startGameLoop();

        this.lastTime = window.performance.now();

    }

    // We process some game data here because the dispatches need derived data
    // (coming from mapStateToProps), and access to oldProps, and access to the
    // populated store data. In that way I've accidentally coupled this
    // component to the game logic. In another life, refactor this to keep
    // derived data out of selector above.
    componentWillReceiveProps( nextProps ) {

        const {
            physicsInitted, gameState, books, chapters, playerRadius,
            playerDensity, pushyDensity, currentLevelStaticEntitiesArray,
            currentLevelMovableEntitiesArray, currentLevelBridgesArray,
            playerPosition, gameStarted, recursionBusterId,
        } = nextProps;

        if( !this.transitioning && gameStarted && ( this.props.recursionBusterId !== recursionBusterId ) ) {

            this.transitioning = true;
            this.transitionFromLastChapterToNextChapter( nextProps );

        // Guard against re-mounts of this component during above fn call,
        // which issues multiple dispatches
        } else if( this.transitioning ) {

            this.transitioning = false;

        }

        // If the game is stopped, reset the initted state
        if( !this.initting && physicsInitted === false && !this.initting ) {

            // Multiple event dispatches means multiple will recieve props,
            // or maybe devtools? Either way guard against it.
            this.initting = true;

            const { world, } = gameState;

            this.props.createPhysicsBodies(
                v3toP2( playerPosition ), world, books, chapters, playerRadius,
                playerDensity, pushyDensity, currentLevelStaticEntitiesArray,
                currentLevelMovableEntitiesArray, currentLevelBridgesArray,
            );

        } else if( this.initting ) {

            this.initting = false;

        }

    }

    // See note in componentWillReceiveProps
    transitionFromLastChapterToNextChapter( nextProps ) {

        const { gameState, } = this.props;
        const {
            cameraPosition: oldCameraPosition, currentTransitionPosition,
            world,
        } = gameState;

        const {
            previousChapterNextChapter, books, chapters, playerRadius,
            playerDensity, pushyDensity, currentLevelStaticEntitiesArray,
            currentLevelMovableEntitiesArray, currentLevelBridgesArray,
            playerScale, cameraFov,
        } = nextProps;

        const {
            position: chapterPosition,
            scale,
        } = previousChapterNextChapter;

        const multiplier = scale.x < 1 ? 8 : 0.125;

        const cameraPosition = new Vector3(
            ( oldCameraPosition.x - chapterPosition.x ) * multiplier,
            getCameraDistanceToPlayer( playerRadius, cameraFov, playerScale ),
            ( oldCameraPosition.z - chapterPosition.z ) * multiplier
        );

        gameState.cameraPosition = cameraPosition;

        emptyWorld( world );

        const newPosition2D = [
            ( currentTransitionPosition.x - chapterPosition.x ) * multiplier,
            ( currentTransitionPosition.z - chapterPosition.z ) * multiplier,
        ];

        this.props.createPhysicsBodies(
            newPosition2D, world, books, chapters, playerRadius,
            playerDensity, pushyDensity, currentLevelStaticEntitiesArray,
            currentLevelMovableEntitiesArray, currentLevelBridgesArray,
        );

        this.props.updateGameState({
            cameraPosition,
            currentTransitionPosition: null,
        });

    }

    componentWillUnmount() {

        this.mounted = false;
        this.stopGameLoop();

    }

    gameLoop( time ) {

        // Gaurd against cases where someone pulled the rug out from under us
        if( !this.mounted || !this.loopStarted ) {
            return;
        }

        this.startGameLoop();

        // The delta always needs to be calculated if the loop is running (ie
        // before the possible return statement below)
        const delta = time - this.lastTime;
        this.lastTime = time;

        const { gameState, gameStarted, } = this.props;

        if( !gameStarted ) {
            return;
        }

        // In any state, (paused, etc), child components need the updaed time
        const currentState = { time, delta, };

        const newState = applyMiddleware(
            // Note: KeyHandler is updated in UpdateAllObjects for now.
            // `this.props` twice for "actions" and "gameData"
            KeyHandler, this.props, this.props, gameState, currentState,
            debugReducer, gameScreenReducer, playerPositionReducer,
            contactEventReducer, speechReducer, physicsReducer,
            gameKeyPressReducer, tourReducer, advanceLevelReducer, zoomReducer,
            entityInteractionReducer, translateEntityReducer,
            playerScaleReducer, defaultCameraReducer, playerAnimationReducer,
            outOfBoundsReducer,
        );

        const { sideEffectQueue, } = newState;

        this.props.setGameState({
            ...newState,
            sideEffectQueue: [],
        });

        // Reducers shouldn't have side effects because it complicates the
        // flow. Process anything after the game loop.
        if( sideEffectQueue.length ) {

            this.stopGameLoop();

            // If we transition to pause screen, for example, the 'P' key needs
            // to already be in repeat mode so we don't get instant unapuse
            KeyHandler.updateFirstPressed();
            sideEffectQueue.forEach( effect => effect() );

            this.startGameLoop();

        }

    }

    startGameLoop() {

        // Reset time so delta is zero if loop was paused
        if( !this.loopStarted ) {
            this.lastTime = window.performance.now();
        }

        this.loopStarted = true;
        this.reqAnimId = window.requestAnimationFrame( this.gameLoop );

    }

    stopGameLoop() {

        this.loopStarted = false;
        window.cancelAnimationFrame( this.reqAnimId );

    }

    setSize( size ) {

        this.setState({
            gameWidth: size,
            gameHeight: size,
        });

    }

    render() {

        const { fonts, assets, books, } = this.props;
        const { gameWidth, gameHeight, } = this.state;
        let content;

        if( !__CLIENT__ ||
            !books ||
            !( 'Sniglet Regular' in fonts ) ||
            !( 'charisma' in assets ) ||
            !( 'charismaLegs' in assets ) ||
            !( 'charismaTail' in assets ) ||
            !( 'eye' in assets ) ||
            !( 'eyeLid' in assets )
        ) {
            content = <div className={ styles.loading }>
                <div className={ styles.loadingContent }>
                    Loading&hellip;
                </div>
            </div>;
        } else {
            content = <GameGUI
                { ...this.props }
                gameWidth={ gameWidth }
                gameHeight={ gameHeight }
                store={ this.context.store }
            />;
        }

        return <div className={ styles.wrap }>
            <div className={ styles.viewportContainer }>
                <div className={ styles.viewPort }>
                    { content }
                </div>
                <div className={ styles.extras }>
                    <div className={ styles.divide10 }>
                        <button
                            onClick={ this.setSize.bind( this, 800 ) }
                            className={ cx({ button: true, selected: gameWidth === 800 }) }
                        >
                            800 x 800
                        </button>
                    </div>
                    <div className={ styles.divide10 }>
                        <button
                            onClick={ this.setSize.bind( this, 600 ) }
                            className={ cx({ button: true, selected: gameWidth === 600 }) }
                        >
                            600 x 600
                        </button>
                    </div>
                    <div className={ styles.divide10 }>
                        <button
                            onClick={ this.setSize.bind( this, 400 ) }
                            className={ cx({ button: true, selected: gameWidth === 400 }) }
                        >
                            400 x 400
                        </button>
                    </div>
                    <h5>
                        created by <b>Andrew Ray</b>
                    </h5>
                    <i className={ cx({ fa: true, 'fa-twitter': true, tweet: true }) } />
                    <a href="https://twitter.com/andrewray" target="_blank">
                        @<u>andrewray</u>
                    </a>
                    <br />
                    <br />
                    shaders by <a href="http://shaderfrog.com/app" target="_blank">ShaderFrog</a>
                </div>
            </div>
        </div>;

    }

}
