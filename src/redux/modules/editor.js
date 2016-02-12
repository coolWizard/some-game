import THREE from 'three';
import { without, uid } from '../../containers/Dung/Utils';

const LOAD = 'redux-example/LEVEL_LOAD';
const LOAD_SUCCESS = 'redux-example/LEVEL_LOAD_SUCCESS';
const LOAD_FAIL = 'redux-example/LEVEL_LOAD_FAIL';

const SAVE_LEVEL = 'redux-example/SAVE_LEVEL';
const SAVE_LEVEL_SUCCESS = 'redux-example/SAVE_LEVEL_SUCCESS';
const SAVE_LEVEL_FAIL = 'redux-example/SAVE_LEVEL_FAIL';

const SAVE_BOOK = 'redux-example/SAVE_BOOK';
const SAVE_BOOK_SUCCESS = 'redux-example/SAVE_BOOK_SUCCESS';
const SAVE_BOOK_FAIL = 'redux-example/SAVE_BOOK_FAIL';

const UPDATE_LEVEL = 'redux-example/UPDATE_LEVEL';
const UPDATE_LEVEL_SUCCESS = 'redux-example/UPDATE_LEVEL_SUCCESS';
const UPDATE_LEVEL_FAIL = 'redux-example/UPDATE_LEVEL_FAIL';

const UPDATE_BOOK = 'redux-example/UPDATE_BOOK';
const UPDATE_BOOK_SUCCESS = 'redux-example/UPDATE_BOOK_SUCCESS';
const UPDATE_BOOK_FAIL = 'redux-example/UPDATE_BOOK_FAIL';

const ADD_ENTITY = 'dung/ADD_ENTITY';
const CREATE_LEVEL_AND_CHAPTER = 'dung/CREATE_LEVEL_AND_CHAPTER';
const ADD_NEXT_LEVEL = 'dung/ADD_NEXT_LEVEL';
const CHANGE_ENTITY_MATERIAL_ID = 'dung/CHANGE_ENTITY_MATERIAL_ID';
const CHANGE_ENTITY_TYPE = 'dung/CHANGE_ENTITY_TYPE';
const DESERIALIZE = 'dung/DESERIALIZE';
const EDITOR_SELECT_LEVEL_AND_CHAPTER = 'dung/EDITOR_SELECT_LEVEL_AND_CHAPTER';
const MODIFY_LEVEL = 'dung/MODIFY_LEVEL';
const MOVE_ENTITY = 'dung/MOVE_ENTITY';
const REMOVE_ENTITY = 'dung/REMOVE_ENTITY';
const REMOVE_NEXT_LEVEL = 'dung/REMOVE_NEXT_LEVEL';
const ROTATE_ENTITY = 'dung/ROTATE_ENTITY';

const INSET_CHAPTER = 'dung/INSET_CHAPTER';
const CREATE_CHAPTER = 'dung/CREATE_CHAPTER';
const MODIFY_CHAPTER = 'dung/MODIFY_CHAPTER';
const SELECT_CHAPTER = 'dung/SELECT_CHAPTER';

const CREATE_BOOK = 'dung/CREATE_BOOK';
const MODIFY_BOOK = 'dung/MODIFY_BOOK';
const EDITOR_SELECT_BOOK = 'dung/EDITOR_SELECT_BOOK';

// Private reducer, only modifies entities themselves. State will be an entity
function entityPropertyReducer( entity, action ) {

    switch( action.type ) {

        case CHANGE_ENTITY_TYPE:

            return {
                ...entity,
                type: action.newType
            };

        case CHANGE_ENTITY_MATERIAL_ID:

            return {
                ...entity,
                materialId: action.newMaterialId
            };

        case MOVE_ENTITY:

            const { field, value } = action;
            const { position } = entity;

            return {
                ...entity,
                position: new THREE.Vector3(
                    field === 'x' ? value : position.x,
                    field === 'y' ? value : position.y,
                    field === 'z' ? value : position.z
                )
            };

        case ROTATE_ENTITY:

            const rField = action.field;
            const rValue = action.value;
            const { rotation } = entity;

            return {
                ...entity,
                rotation: new THREE.Vector3(
                    field === 'x' ? value : rotation.x,
                    field === 'y' ? value : rotation.y,
                    field === 'z' ? value : rotation.z
                )
            };

        case INSET_CHAPTER:
            return {
                ...entity,
                position: action.position,
                scale: action.scale
            };

        case DESERIALIZE:
            return {
                ...entity,
                id: entity.id.toString(),
                position: new THREE.Vector3().copy( entity.position ),
                // Level entities don't have rotation saved
                rotation: entity.rotation ?
                    new THREE.Quaternion( entity.rotation._x, entity.rotation._y, entity.rotation._z, entity.rotation._w ) :
                    new THREE.Quaternion( 0, 0, 0, 1 ),
                scale: new THREE.Vector3().copy( entity.scale )
            };

        default:
            return entity;

    }

}

// Handles all entities. State is an object of { id: entity, ... }
export function entitiesReducer( entities = {}, action = {} ) {

    switch( action.type ) {

        case LOAD_SUCCESS:
            return {
                ...entities,
                ...action.result.entities
            };

        case ADD_NEXT_LEVEL:
        case ADD_ENTITY:

            return {
                ...entities,
                [ action.id ]: {
                    id: action.id,
                    type: action.entityType,
                    position: action.position,
                    scale: action.scale,
                    rotation: action.rotation || new THREE.Quaternion( 0, 0, 0, 1 ),
                    materialId: action.materialId
                }
            };

        case REMOVE_NEXT_LEVEL:

            return without( entities, action.nextLevelEntityId );

        case REMOVE_ENTITY:

            return without( entities, action.id );

        case ROTATE_ENTITY:
        case MOVE_ENTITY:
        case CHANGE_ENTITY_TYPE:
        case CHANGE_ENTITY_MATERIAL_ID:

            return {
                ...entities,
                [ action.id ]: entityPropertyReducer( entities[ action.id ], action )
            };

        case INSET_CHAPTER:
            return {
                ...entities,
                [ action.nextLevelEntityId ]: entityPropertyReducer( entities[ action.nextLevelEntityId ], action )
            };

        case DESERIALIZE:
            return Object.keys( entities ).reduce( ( memo, id ) => {
                memo[ id ] = entityPropertyReducer( entities[ id ], action );
                return memo;
            }, {} );

        default:
            return entities;
            
    }

}

function removeNextLevelFrom( level, nextLevelId ) {

    const nextData = level.nextLevels.find( data => data.levelid === nextLevelId );

    return {
        ...level,
        entityIds: level.entityIds.filter( id => id !== nextData.entityId ),
        nextLevelIds: level.nextLevelIds.filter( data => data.levelId !== nextLevelId )
    };

}

// Private reducer, only modifies levels. state will be an individual level
function individualLevelReducer( level, action ) {

    switch( action.type ) {

        case ADD_NEXT_LEVEL:
            return {
                ...level,
                nextLevelIds: [ ...level.nextLevelIds, {
                    levelId: action.nextLevelId,
                    entityId: action.id,
                } ],
                entityIds: [ ...level.entityIds, action.id ]
            };

        case ADD_ENTITY:
            return {
                ...level,
                entityIds: [ ...level.entityIds, action.id ]
            };

        case REMOVE_NEXT_LEVEL:
            return removeNextLevelFrom( level, action.nextLevelId, action.nextLevelEntityId );

        case REMOVE_ENTITY:
            return {
                ...level,
                entityIds: level.entityIds.filter( id => id !== action.id )
            };

        case INSET_CHAPTER:
            return {
                ...level,
                nextLevelIds: [ ...level.nextLevelIds, {
                    levelId: action.currentLevelId,
                    entityId: action.nextLevelEntityId,
                }],
                entityIds: [
                    ...level.entityIds.filter( id => id !== action.previousLevelNextLevelEntityIdIfAny ),
                    action.nextLevelEntityId
                ]
            };

        case DESERIALIZE:
            // Levacy levels could have numeric IDs
            return {
                ...level,
                id: level.id.toString(),
                entityIds: level.entityIds.map( id => id.toString() )
            };

        default:
            return level;

    }

}

// Top level levels reducer. State is a key value hash of all levels
export function levelsReducer( levels = {}, action = {} ) {

    switch( action.type ) {

        case LOAD_SUCCESS:
            return {
                ...levels,
                ...action.result.levels
            };

        case SAVE_LEVEL_FAIL:

            console.error( 'Save fail', action );
            return levels;

        case SAVE_LEVEL_SUCCESS:

            const oldLevel = levels[ action.result.oldLevelId ];
            return {
                ...without( levels, oldLevel.id ),
                [ action.result.newLevelId ]: {
                    ...oldLevel,
                    id: action.result.newLevelId,
                    saved: true
                }
            };

        case MODIFY_LEVEL:
            return {
                ...levels,
                [ action.id ]: {
                    ...levels[ action.id ],
                    [ action.field ]: action.value
                }
            };

        case CREATE_LEVEL_AND_CHAPTER:
            return {
                ...levels,
                [ action.levelId ]: {
                    id: action.levelId,
                    name: action.name,
                    entityIds: [],
                    nextLevelIds: []
                }
            };

        case REMOVE_NEXT_LEVEL:
        case ADD_NEXT_LEVEL:
        case REMOVE_ENTITY:
        case ADD_ENTITY:
            return {
                ...levels,
                [ action.levelId ]: individualLevelReducer( levels[ action.levelId ], action )
            };

        case INSET_CHAPTER:
            return {
                ...levels,
                // remove the next level (the one we're insetting) from the
                // curent level
                [ action.currentLevelId ]: removeNextLevelFrom( levels[ action.currentLevelId ], action.previousLevelNextLevelEntityIdIfAny, action.nextLevelEntityId ),
                [ action.nextLevelId ]: individualLevelReducer( levels[ action.nextLevelId ], action )
            };

        case DESERIALIZE:
            return Object.keys( levels ).reduce( ( memo, id ) => {
                memo[ id ] = individualLevelReducer( levels[ id ], action );
                return memo;
            }, {} );

        default:
            return levels;

    }

}

// Handle all normalized chapters. chapters is a key value hash of all chapters
export function chaptersReducer( chapters = {}, action = {} ) {

    switch( action.type ) {

        case LOAD_SUCCESS:
            return {
                ...chapters,
                ...action.result.chapters
            };

        case CREATE_CHAPTER:
            return {
                ...chapters,
                [ action.id ]: {
                    id: action.id,
                    name: action.name,
                    levelId: action.id,
                    nextChapters: []
                }
            };

        case CREATE_LEVEL_AND_CHAPTER:
            return {
                ...chapters,
                [ action.chapterId ]: {
                    id: action.chapterId,
                    name: 'Chapter for ' + action.name,
                    levelId: action.id,
                    nextChapters: []
                }
            };

        // A chapter contains a reference to a level id. We need to update that
        // id on level save, because levelId changes
        case SAVE_LEVEL_SUCCESS:
            return Object.keys( chapters ).reduce( ( memo, id ) => {

                if( chapters[ id ].levelId === action.result.oldLevelId ) {

                    memo[ id ] = {
                        ...chapters[ id ],
                        levelId: action.result.newLevelId
                    };

                } else {

                    memo[ id ] = chapters[ id ];

                }

                return memo;

            }, {} );

        case MODIFY_CHAPTER:
            return {
                ...chapters,
                [ action.id ]: {
                    ...chapters[ action.id ],
                    [ action.field ]: action.value
                }
            };

        default:
            return chapters;

    }

}

function individualBookReducer( book = {}, action ) {

    switch( action.type ) {

        // Currently level id is just duplicated to chapter id, because they're
        // in different domains
        case CREATE_LEVEL_AND_CHAPTER:
            return {
                ...book,
                chapterIds: [
                    ...book.chapterIds,
                    action.chapterId
                ]
            };

        default:
            return book;

    }
}

export function booksReducer( books = {}, action = {} ) {

    switch( action.type ) {

        case LOAD_SUCCESS:
            return {
                ...books,
                ...action.result.books
            };

        case SAVE_BOOK_SUCCESS:

            const oldBook = books[ action.result.oldBookId ];
            return {
                ...without( books, oldBook.id ),
                [ action.result.newBookId ]: {
                    ...oldBook,
                    id: action.result.newBookId,
                    saved: true
                }
            };

        case MODIFY_BOOK:
            return {
                ...books,
                [ action.id ]: {
                    ...books[ action.id ],
                    id: action.id,
                    [ action.field ]: action.value
                }
            };

        case CREATE_BOOK:
            return {
                ...books,
                [ action.id ]: {
                    id: action.id,
                    name: action.name,
                    chapterIds: [],
                    nextBookIds: []
                }
            };

        case CREATE_LEVEL_AND_CHAPTER:
            return {
                ...books,
                [ action.bookId ]: individualBookReducer( books[ action.bookId ], action )
            };

        case REMOVE_NEXT_LEVEL:
        case ADD_NEXT_LEVEL:
            return {
                ...books,
                [ action.bookId ]: individualBookReducer( books[ action.bookId ], action )
            };

        case INSET_CHAPTER:
            return {
                ...books,
                // remove the next level (the one we're insetting) from the
                // curent level
                [ action.currentLevelId ]: removeNextLevelFrom( books[ action.currentLevelId ], action.previousLevelNextLevelEntityIdIfAny, action.nextLevelEntityId ),
                [ action.nextLevelId ]: individualLevelReducer( books[ action.nextLevelId ], action )
            };

        default:
            return books;

    }

}

export function editorSelectedBookReducer( state = null, action = {} ) {

    switch( action.type ) {

        // Creating a book should auto-select it
        case CREATE_BOOK:
        case EDITOR_SELECT_BOOK:
            return action.id;

        // Select the newest id because it will change
        case SAVE_BOOK_SUCCESS:
            return action.result.newBookId;

        default:
            return state;

    }

}

export function editorSelectedLevelReducer( levelId = null, action = {} ) {

    switch( action.type ) {

        // Select the newest id because it will change
        case SAVE_LEVEL_SUCCESS:
            return action.result.newLevelId;

        case CREATE_LEVEL_AND_CHAPTER:
        case EDITOR_SELECT_LEVEL_AND_CHAPTER:
            return action.levelId;

        // Reset selected level on new book selection
        case EDITOR_SELECT_BOOK:
        case CREATE_BOOK:
            return null;

        default:
            return levelId;

    }

}

export function editorSelectedChapterReducer( chapterId = null, action = {} ) {

    switch( action.type ) {

        // Auto select the chapter when created with a level
        case CREATE_LEVEL_AND_CHAPTER:
        case EDITOR_SELECT_LEVEL_AND_CHAPTER:
            return action.chapterId;

        // Reset selected chapter on new book selection
        case EDITOR_SELECT_BOOK:
        case CREATE_BOOK:
            return null;

        default:
            return chapterId;

    }

}

export function loadLevelsReducer( state = {}, action = {} ) {

    switch( action.type ) {

        case LOAD_SUCCESS:
            return {
                ...state,
                loaded: true
            };

        default:
            return state;

    }

}

// Actions
export function createBook( name ) {
    return {
        type: CREATE_BOOK,
        id: uid(),
        name
    };
}

export function selectBook( id ) {
    return {
        type: EDITOR_SELECT_BOOK,
        id
    };
}

export function createChapter( name, levelId ) {
    return {
        type: CREATE_CHAPTER,
        id: uid(),
        levelId, name
    };
}

export function selectChapter( id ) {
    return {
        type: SELECT_CHAPTER,
        id
    };
}

export function createLevel( name, bookId ) {
    return {
        type: CREATE_LEVEL_AND_CHAPTER,
        levelId: uid(),
        chapterId: uid(),
        bookId, name
    };
}

export function selectLevelAndChapter( levelId, chapterId ) {
    return {
        type: EDITOR_SELECT_LEVEL_AND_CHAPTER,
        levelId, chapterId
    };
}

export function addEntity( levelId, entityType, position, scale, rotation, materialId ) {
    return {
        type: ADD_ENTITY,
        id: uid(),
        levelId, entityType, position, scale, rotation, materialId
    };
}

export function removeEntity( levelId, id, entityType ) {
    return {
        type: REMOVE_ENTITY,
        levelId, id, entityType
    };
}

export function moveEntity( id, field, value ) {
    return {
        type: MOVE_ENTITY,
        id, field, value
    };
}

export function rotateEntity( id, field, value ) {
    return {
        type: ROTATE_ENTITY,
        id, field, value
    };
}

export function changeEntityMaterial( id, newMaterialId ) {
    return {
        type: CHANGE_ENTITY_MATERIAL_ID,
        id, newMaterialId
    };
}

export function renameLevel( id, name ) {
    return {
        type: MODIFY_LEVEL,
        field: 'name',
        value: name,
        id
    };
}

export function renameBook( id, name ) {
    return {
        type: MODIFY_BOOK,
        field: 'name',
        value: name,
        id
    };
}

export function renameChapter( id, name ) {
    return {
        type: MODIFY_CHAPTER,
        field: 'name',
        value: name,
        id
    };
}

export function addNextLevel( levelId, nextLevelId, position, scale ) {
    return {
        type: ADD_NEXT_LEVEL,
        entityType: 'level',
        id: uid(),
        levelId, nextLevelId, position, scale
    };
}

export function insetChapter( currentLevelId, nextLevelId, nextLevelEntityId, previousLevelNextLevelEntityIdIfAny, position, scale ) {
    return {
        type: INSET_CHAPTER,
        currentLevelId, nextLevelId, nextLevelEntityId,
        previousLevelNextLevelEntityIdIfAny, position, scale
    };
}

export function removeNextBook( levelId, nextLevelId, nextLevelEntityId ) {
    return {
        type: REMOVE_NEXT_LEVEL,
        levelId, nextLevelId, nextLevelEntityId
    };
}

export function deserializeLevels() {
    return { type: DESERIALIZE };
}

export function loadAllData() {
    return {
        types: [ LOAD, LOAD_SUCCESS, LOAD_FAIL ],
        promise: client => client.get( '/loadAllData' )
    };
}

export function saveLevel( levelData, entities ) {
    return {
        types: [ SAVE_LEVEL, SAVE_LEVEL_SUCCESS, SAVE_LEVEL_FAIL ],
        promise: client => client.post( '/saveLevel', { data: { levelData, entities } } )
    };
}

export function saveBook( bookData, chapters ) {
    return {
        types: [ SAVE_BOOK, SAVE_BOOK_SUCCESS, SAVE_BOOK_FAIL ],
        promise: client => client.post( '/saveBook', { data: { bookData, chapters } } )
    };
}

export function updateLevel( levelData, entities ) {
    return {
        types: [ UPDATE_LEVEL, UPDATE_LEVEL_SUCCESS, UPDATE_LEVEL_FAIL ],
        promise: client => client.post( '/updateLevel', { data: { levelData, entities } } )
    };
}

export function updateBook( bookData, chapters ) {
    return {
        types: [ UPDATE_BOOK, UPDATE_BOOK_SUCCESS, UPDATE_BOOK_FAIL ],
        promise: client => client.post( '/updateBook', { data: { bookData, chapters } } )
    };
}

export function areLevelsLoaded( globalState ) {

    return globalState.levelsLoaded && globalState.levelsLoaded.loaded;

}

export function changeEntityType( id, newType ) {
    return {
        type: CHANGE_ENTITY_TYPE,
        id, newType
    };
}
