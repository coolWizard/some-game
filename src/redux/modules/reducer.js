import { combineReducers } from 'redux';
import multireducer from 'multireducer';
import { routerStateReducer } from 'redux-router';

import auth from './auth';
import counter from './counter';
import {reducer as form} from 'redux-form';
import info from './info';
import widgets from './widgets';
import { assetsReducer } from './assets';
import { game, gameLevelReducer } from './game';
import { loadLevelsReducer, levelsReducer, entitiesReducer, editorLevelReducer } from './editor';

export default combineReducers({
    router: routerStateReducer,
    auth,
    form,
    levelsLoaded: loadLevelsReducer,
    levels: levelsReducer,
    assets: assetsReducer,
    entities: entitiesReducer,
    currentEditorLevel: editorLevelReducer,
    currentGameLevel: gameLevelReducer,
    game,
    multireducer: multireducer({
        counter1: counter,
        counter2: counter,
        counter3: counter
    }),
    info,
    widgets
});
