import React, { Component, PropTypes } from 'react';
import THREE from 'three';
import Textures from '../../helpers/Textures'; // todo: pass as prop?

import {
    Shrink, Grow, Wall, Floor, Pushy, TubeBend, TubeStraight, Player,
    FinishLine, House, Waterfall,
} from '../';

export default class StaticEntities extends Component {

    static propTypes = {
        time: PropTypes.number,
        entities: PropTypes.array.isRequired,
        world: PropTypes.object,
        paused: PropTypes.bool,
        playerRadius: PropTypes.number,
        playerBody: PropTypes.object,
    }

    render() {

        const {
            entities, time, position, scale, opacity, shaders, assets, world,
            paused, playerRadius, playerBody,
        } = this.props;

        return <group
            ref="group"
            position={ position }
            scale={ scale }
        >

            { entities.map( ( entity ) => {

                if( entity.type === 'wall' ) {

                    return <Wall
                        shaders={ shaders }
                        ref={ entity.id }
                        key={ entity.id }
                        position={ entity.position }
                        rotation={ entity.rotation }
                        scale={ entity.scale }
                        materialId={ entity.materialId }
                    />;

                } else if( entity.type === 'waterfall' || entity.type === 'dirt' ) {

                    return <Waterfall
                        time={ time }
                        ref={ entity.id }
                        key={ entity.id }
                        position={ entity.position }
                        rotation={ entity.rotation }
                        scale={ entity.scale }
                        world={ world }
                        paused={ paused }
                        playerRadius={ playerRadius }
                        playerBody={ playerBody }
                        materialId={ entity.materialId }
                    />;

                } else if( entity.type === 'pushy' ) {

                    return <Pushy
                        ref={ entity.id }
                        key={ entity.id }
                        position={ entity.position }
                        rotation={ entity.rotation }
                        scale={ entity.scale }
                        materialId="pushyMaterial"
                    />;

                } else if( entity.type === 'floor' ) {

                    return <Floor
                        ref={ entity.id }
                        key={ entity.id }
                        assets={ assets }
                        position={ entity.position }
                        rotation={ entity.rotation }
                        scale={ entity.scale }
                        materialId={ entity.materialId }
                    />;

                } else if( entity.type === 'tube' ) {

                    return <TubeStraight
                        ref={ entity.id }
                        key={ entity.id }
                        position={ entity.position }
                        rotation={ entity.rotation }
                        scale={ entity.scale }
                        materialId="tubeMaterial"
                    />;

                } else if( entity.type === 'tubebend' ) {

                    return <TubeBend
                        ref={ entity.id }
                        key={ entity.id }
                        position={ entity.position }
                        rotation={ entity.rotation }
                        scale={ entity.scale }
                        materialId="tubeMaterial"
                    />;

                } else if( entity.type === 'house' ) {

                    return <House
                        ref={ entity.id }
                        key={ entity.id }
                        assets={ assets }
                        position={ entity.position }
                        rotation={ entity.rotation }
                        scale={ entity.scale }
                        materialId="sfHouse"
                    />;

                } else if( entity.type === 'finish' ) {

                    return <FinishLine
                        ref={ entity.id }
                        key={ entity.id }
                        position={ entity.position }
                        rotation={ entity.rotation }
                        scale={ entity.scale }
                        materialId="finishFlag"
                        floorMaterialId="ornateWall1"
                    />;

                } else if( entity.type === 'shrink' ) {

                    return <Shrink
                        time={ time }
                        ref={ entity.id }
                        key={ entity.id }
                        position={ entity.position }
                        rotation={ entity.rotation }
                        scale={ entity.scale }
                        wrapMaterialId={ entity.wrapMaterialId }
                        materialId={ entity.materialId }
                    />;

                } else if( entity.type === 'grow' ) {

                    return <Grow
                        time={ time }
                        ref={ entity.id }
                        key={ entity.id }
                        position={ entity.position }
                        rotation={ entity.rotation }
                        scale={ entity.scale }
                        wrapMaterialId={ entity.wrapMaterialId }
                        materialId={ entity.materialId }
                    />;

                } else if( entity.type === 'player' ) {

                    return <Player
                        ref={ entity.id }
                        key={ entity.id }
                        position={ entity.position }
                        rotation={ entity.rotation }
                        quaternion={ entity.quaternion }
                        radius={ 0.5 }
                        materialId="playerMaterial"
                    />;

                } else {

                    console.warn( 'Unknown entity type!', entity );
                    return <group />;

                }

            }) }

        </group>;

    }

}
