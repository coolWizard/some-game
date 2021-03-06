import React, { Component, PropTypes } from 'react';
import { Vector3, } from 'three';
import p2 from 'p2';
import { Player, EntityGroup } from 'components';
import { lookAtVector, p2ToV3, p2AngleToEuler, } from 'helpers/Utils';

export default class GameRenderer extends Component {

    static propTypes = {
        onPause: PropTypes.func.isRequired,
        fonts: PropTypes.object.isRequired,
        letters: PropTypes.object.isRequired,
    }

    constructor( props, context ) {

        super( props, context );
        
        this.state = {};

        this._onUpdate = this._onUpdate.bind( this );
        this._getMeshStates = this._getMeshStates.bind( this );
        this._getPlankStates = this._getPlankStates.bind( this );
        this._getAnchorStates = this._getAnchorStates.bind( this );

    }

    _getMeshStates( bodies ) {

        const { allEntities } = this.props;

        return bodies.map( physicsBody => {
            const { position, scale, entityId } = physicsBody;
            const entity = allEntities[ physicsBody.entityId ];
            return {
                ...entity,
                scale: new Vector3().copy( scale ),
                position: p2ToV3( position, physicsBody.depth ),
                entityId
            };
        });

    }

    // 1. Build plank bodies in *world* space in physics setup
    // 2. Convert planks to *local object* space here
    // 3. Draw them in plankbridge in local space (adjusting for scale)
    _getPlankStates( plankData ) {

        const { allEntities } = this.props;

        return plankData.reduce( ( memo, plankBody ) => {

            const { position, angle, entityId } = plankBody;
            const entity = allEntities[ plankBody.entityId ];

            const planks = memo[ entityId ] = memo[ entityId ] || [];

            return {
                ...memo,
                [ entityId ]: [
                    ...planks, {
                        position: p2ToV3( position, plankBody.depth )
                            // Convert to local position...
                            .sub( entity.position )
                            // and scale
                            .divideScalar( entity.scale.y ),
                        rotation: p2AngleToEuler( angle )
                    }
                ]
            };

        }, {} );

    }
    
    _getAnchorStates( plankConstraints ) {

        const { allEntities } = this.props;

        return plankConstraints.reduce( ( memo, constraint ) => {

            const { entityId } = constraint;
            const entity = allEntities[ constraint.entityId ];

            const planks = memo[ entityId ] = memo[ entityId ] || [];

            const worldPositionA = [];
            constraint.bodyA.toWorldFrame( worldPositionA, constraint.localAnchorA );

            const worldPositionB = [];
            constraint.bodyB.toWorldFrame( worldPositionB, constraint.localAnchorB );

            return {
                ...memo,
                [ entityId ]: [
                    ...planks, {
                        positionA: p2ToV3( worldPositionA, constraint.depth )
                            .sub( entity.position )
                            .divideScalar( entity.scale.y ),
                        positionB: p2ToV3( worldPositionB, constraint.depth )
                            .sub( entity.position )
                            .divideScalar( entity.scale.y ),
                    }
                ]
            };

        }, {} );

    }

    _onUpdate() {

        const { gameState, } = this.props;
        const { world, } = gameState;

        if( !world ) {
            return;
        }

        // Maybe worth moving into reducers?
        this.setState({
            movableEntities: this._getMeshStates( gameState.physicsBodies ),
            plankEntities: this._getPlankStates( gameState.plankData ),
            anchorEntities: this._getAnchorStates( gameState.plankConstraints ),
        });

    }

    render() {

        const { gameState, physicsInitted, } = this.props;

        if( !gameState || !gameState.world || !physicsInitted ) {

            return <object3D />;

        }

        const {
            world, playerContact, playerBody, time, cameraPosition,
            cameraPositionZoomOut, cameraPositionZoomIn, currentFlowPosition,
            debug, touring, cameraTourTarget, entrance1, entrance2, tubeFlow,
            tubeIndex, currentTransitionPosition, currentTransitionTarget,
            scalingOffsetZ, adjustedPlayerScale, playerRotation,
            playerScaleEffectsEnabled, playerScaleEffectsVisible,
            rightEyeRotation, leftEyeRotation, rightLidRotation,
            leftLidRotation, headAnimations, legAnimations, tailAnimations,
            eyeMorphTargets, tailRotation, tailPosition, playerPositionV3,
        } = gameState;

        const {
            movableEntities, plankEntities, anchorEntities,
        } = ( this.state.debuggingReplay ? this.state.debuggingReplay[ this.state.debuggingIndex ] : this.state );

        const {
            playerRadius, playerScale, nextChapters, nextChaptersEntities,
            previousChapterEntities, previousChapterEntity,
            currentLevelRenderableEntitiesArray, previousChapterFinishEntity,
            assets, shaders, paused, playerMaterialId, playerTexture,
            playerTextureLegs, playerTextureTail, gameWidth, gameHeight,
            cameraFov, cameraAspect,
        } = this.props;

        const playerPosition = new Vector3()
            .copy(
                currentTransitionPosition || currentFlowPosition || playerPositionV3 || new Vector3( 0, 0, 0 )
            )
            .sub({ x: 0, y: 0, z: scalingOffsetZ || 0 });

        const lookAt = lookAtVector(
            cameraPosition,
            touring ? cameraTourTarget : playerPosition
        );

        return <object3D
            onUpdate={ this._onUpdate }
        >

            <perspectiveCamera
                name="mainCamera"
                ref="camera"
                fov={ cameraFov }
                aspect={ cameraAspect }
                near={ 0.1 }
                far={ 1000 }
                position={ cameraPositionZoomIn || cameraPositionZoomOut || cameraPosition }
                quaternion={ lookAt }
            />

            <Player
                ref="player"
                exposeMatrix
                assets={ assets }
                scaleEffectsEnabled={ playerScaleEffectsEnabled }
                scaleEffectsVisible={ playerScaleEffectsVisible }
                position={ playerPosition }
                radius={ playerRadius }
                scale={ adjustedPlayerScale }
                rotation={ playerRotation }
                materialId={ playerMaterialId }
                playerTexture={ playerTexture }
                playerTextureLegs={ playerTextureLegs }
                playerTextureTail={ playerTextureTail }
                leftLidRotation={ leftLidRotation }
                rightLidRotation={ rightLidRotation }
                leftEyeRotation={ leftEyeRotation }
                rightEyeRotation={ rightEyeRotation }
                eyeMorphTargets={ eyeMorphTargets }
                headAnimations={ headAnimations }
                legAnimations={ legAnimations }
                tailAnimations={ tailAnimations }
                tailRotation={ tailRotation }
                tailPosition={ tailPosition }
                time={ time }
            />

            { movableEntities ? <EntityGroup
                showInvisible={ debug }
                paused={ paused }
                playerBody={ playerBody }
                world={ world }
                assets={ assets }
                shaders={ shaders }
                debug={ debug }
                playerRadius={ playerRadius }
                entities={ movableEntities }
                time={ time }
            /> : null }

            <EntityGroup
                showInvisible={ debug }
                paused={ paused }
                playerBody={ playerBody }
                world={ world }
                assets={ assets }
                shaders={ shaders }
                debug={ debug }
                playerRadius={ playerRadius }
                entities={ currentLevelRenderableEntitiesArray }
                plankEntities={ plankEntities }
                anchorEntities={ anchorEntities }
                time={ time }
            />

            { nextChapters.map( nextChapter => <EntityGroup
                showInvisible={ debug }
                paused={ paused }
                key={ nextChapter.id }
                assets={ assets }
                shaders={ shaders }
                debug={ debug }
                position={ nextChapter.position }
                scale={ nextChapter.scale }
                playerRadius={ playerRadius }
                entities={ nextChaptersEntities[ nextChapter.chapterId ] }
                time={ time }
            /> )}

            { previousChapterEntity && <EntityGroup
                showInvisible={ debug }
                paused={ paused }
                assets={ assets }
                shaders={ shaders }
                debug={ debug }
                position={ previousChapterEntity.position }
                scale={ previousChapterEntity.scale }
                entities={ previousChapterEntities }
                playerRadius={ playerRadius }
                time={ time }
                opacity={ 0.5 }
            /> }

            { debug && <mesh
                position={ playerPositionV3 }
                scale={ new Vector3(
                    playerRadius * 2,
                    0.2 * playerRadius,
                    playerRadius * 2,
                ) }
            >
                <geometryResource
                    resourceId="1x1cylinder"
                />
                <materialResource
                    resourceId="purpleDebugMaterial"
                />
            </mesh> }

            { debug && previousChapterFinishEntity && <mesh
                position={ previousChapterFinishEntity.position }
                scale={ previousChapterFinishEntity.scale }
            >
                <geometryResource
                    resourceId="1x1box"
                />
                <materialResource
                    resourceId="purpleDebugMaterial"
                />
            </mesh> }

            { debug && currentTransitionTarget && <mesh
                position={ currentTransitionTarget }
                scale={ new Vector3( 0.2, 2, 0.2 ).multiplyScalar( playerScale ) }
            >
                <geometryResource
                    resourceId="1x1box"
                />
                <materialResource
                    resourceId="exitMaterial"
                />
            </mesh> }

            { debug && tubeFlow && tubeFlow[ tubeIndex ].middle && <mesh
                position={ tubeFlow[ tubeIndex ].middle }
                scale={ new Vector3( 0.25, 2, 0.25 ).multiplyScalar( playerScale ) }
            >
                <geometryResource
                    resourceId="playerGeometry"
                />
                <materialResource
                    resourceId="middleMaterial"
                />
            </mesh> }
            { debug && tubeFlow && <mesh
                position={ ( tubeIndex === tubeFlow.length - 1 ?
                    tubeFlow[ tubeIndex ].exit :
                    tubeFlow[ tubeIndex ].end
                ) }
                scale={ new Vector3( 0.15, 2, 0.15 ).multiplyScalar( playerScale ) }
            >
                <geometryResource
                    resourceId="playerGeometry"
                />
                <materialResource
                    resourceId="exitMaterial"
                />
            </mesh> }
            { debug && tubeFlow && <mesh
                position={ tubeFlow[ tubeIndex ].start }
                scale={ new Vector3( 0.15, 2, 0.15 ).multiplyScalar( playerScale ) }
            >
                <geometryResource
                    resourceId="playerGeometry"
                />
                <materialResource
                    resourceId="entranceMaterial"
                />
            </mesh> }

            { debug && entrance1 && <mesh
                position={ entrance1 }
                scale={ new Vector3( 0.5, 2, 0.5 ).multiplyScalar( playerScale )}
            >
                <geometryResource
                    resourceId="playerGeometry"
                />
                <materialResource
                    resourceId="greenDebugMaterial"
                />
            </mesh> }
            { debug && entrance2 && <mesh
                position={ entrance2 }
                scale={ new Vector3( 0.5, 2, 0.5 ).multiplyScalar( playerScale )}
            >
                <geometryResource
                    resourceId="playerGeometry"
                />
                <materialResource
                    resourceId="exitMaterial"
                />
            </mesh> }
            { debug && gameState.playerSnapped && <mesh
                position={gameState.playerSnapped }
                scale={ new Vector3( 0.1, 3.5, 0.1 ).multiplyScalar( playerScale ) }
            >
                <geometryResource
                    resourceId="playerGeometry"
                />
                <materialResource
                    resourceId="exitMaterial"
                />
            </mesh> }
            { debug && gameState.playerTowardTube && <mesh
                position={gameState.playerTowardTube }
                scale={ new Vector3( 0.1, 3.5, 0.1 ).multiplyScalar( playerScale ) }
            >
                <geometryResource
                    resourceId="playerGeometry"
                />
                <materialResource
                    resourceId="greenDebugMaterial"
                />
            </mesh> }

            { debug && Object.keys( playerContact || {} ).map( key => {

                return <mesh
                    position={ playerPosition.clone().add( playerContact[ key ].clone().multiplyScalar( playerScale ) ) }
                    scale={ new Vector3( 0.1, 3, 0.15 ).multiplyScalar( playerScale ) }
                    key={ key }
                >
                    <geometryResource
                        resourceId="playerGeometry"
                    />
                    <materialResource
                        resourceId="blueDebugMaterial"
                    />
                </mesh>;

            }) }

            { debug && world.narrowphase.contactEquations.map( ( contact, index ) => {
                const { contactPointA, bodyA } = contact;
                return <mesh
                    scale={ new Vector3( playerScale * 0.1, playerScale * 3, playerScale * 0.1 ) }
                    key={ `contact_${ index }_a` }
                    position={ p2ToV3( p2.vec2.add( [ 0, 0 ], contactPointA, bodyA.position ), 1 ) }
                >
                    <geometryResource
                        resourceId="radius1sphere"
                    />
                    <materialResource
                        resourceId="greenDebugMaterial"
                    />
                </mesh>;
            }) }

        </object3D>;

    }

}
