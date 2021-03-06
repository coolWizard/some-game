import THREE from 'three';
import { getCameraDistanceToPlayer, lerpVectors, } from '../helpers/Utils';
import { easeOutQuint, easeOutQuad } from 'easing-utils';
import { L, } from 'helpers/KeyCodes';

const zoomOutDurationMs = 750;
const zoomInDurationMs = 500;

function zoomedOutPosition( cameraFov ) {

    return new THREE.Vector3(
        0,
        0.5 + getCameraDistanceToPlayer( 1.5, cameraFov, 1 ),
        0,
    );

}

export default function zoomOutReducer(
    keysDown:Object,
    actions:Object,
    gameData:Object,
    oldState:Object,
    currentState:Object,
) {

    const { cameraFov, } = gameData;

    const {
        zoomBackInDuration, zoomOutStartTime, cameraPositionZoomOut,
        startZoomBackInTime, cameraPosition,
    } = oldState;

    const { time, } = currentState;

    const newState = {};

    if( keysDown.isPressed( L ) && !zoomBackInDuration ) {

        newState.zoomOutStartTime = zoomOutStartTime || time;

        const howFarZoomedOut = Math.min( ( time - newState.zoomOutStartTime ) / zoomOutDurationMs, 1 );

        newState.cameraPositionZoomOut = lerpVectors(
            cameraPosition,
            zoomedOutPosition( cameraFov ),
            howFarZoomedOut,
            easeOutQuint
        );

    } else if( cameraPositionZoomOut ) {

        // Then start zooming in to the orignal target
        if( !zoomBackInDuration ) {

            const howFarZoomedOut = Math.min(
                ( time - zoomOutStartTime ) / zoomOutDurationMs,
                1
            );
            newState.zoomBackInDuration = zoomInDurationMs * howFarZoomedOut;
            newState.startZoomBackInTime = time;
            newState.zoomOutStartTime = null;

        }

        const _zoomBackInDuration = newState.zoomBackInDuration || zoomBackInDuration;
        const _startZoomBackInTime = newState.startZoomBackInTime || startZoomBackInTime;

        const howFarZoomedIn = Math.min(
            ( time - _startZoomBackInTime ) / _zoomBackInDuration,
            1
        );

        newState.cameraPositionZoomOut = lerpVectors(
            zoomedOutPosition( cameraFov ),
            cameraPosition,
            howFarZoomedIn,
            easeOutQuad
        );

        if( howFarZoomedIn === 1 ) {

            newState.zoomBackInDuration = null;
            newState.startZoomBackInTime = null;
            newState.zoomOutStartTime = null;
            newState.cameraPositionZoomOut = null;

        }

    }

    if( Object.keys( newState ).length ) {

        // Short circuit
        return {
            ...currentState,
            ...newState
        };

    } else {

        return currentState;

    }

}
