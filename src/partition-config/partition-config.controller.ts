import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { PartitionConfigService } from './partition-config.service';
import { CreatePartitionConfigDto, UpdatePartitionConfigDto, PartitionConfigResponseDto } from './dto/create-partition-config.dto';

@Controller('partition-config')
export class PartitionConfigController {

    constructor (
        private partitionConfigService: PartitionConfigService,
    ) {}

    /**
       * GET /partitions/config
       * Get all partition configurations
       */
    @Get('config')
    @ApiOperation({
        summary: 'List partition configurations',
        description: 'Retrieves all partition management configurations from database'
    })
    @ApiResponse({
        status: 200,
        description: 'Configuration list retrieved successfully',
        type: [PartitionConfigResponseDto]
    })
    async getAllConfigs() {
        return await this.partitionConfigService.getAllConfigs();
    }

    /**
         * GET /partitions/config/:id
         * Get partition configuration by ID
         */
    @Get('config/:id')
    @ApiOperation({
        summary: 'Get partition configuration',
        description: 'Retrieves a specific partition configuration by ID'
    })
    @ApiParam({
        name: 'id',
        description: 'Configuration ID',
        example: 1
    })
    @ApiResponse({
        status: 200,
        description: 'Configuration retrieved successfully',
        type: PartitionConfigResponseDto
    })
    @ApiResponse({
        status: 404,
        description: 'Configuration not found'
    })
    async getConfigById(@Param('id') id: string) {
        return await this.partitionConfigService.getConfigById(+id);
    }

    /**
         * POST /partitions/config
         * Create partition configuration
         */
    @Post('config')
    @ApiOperation({
        summary: 'Create partition configuration',
        description: 'Creates a new partition management configuration for a table'
    })
    @ApiResponse({
        status: 201,
        description: 'Configuration created successfully',
        type: PartitionConfigResponseDto
    })
    @ApiResponse({
        status: 400,
        description: 'Invalid input data'
    })
    @ApiResponse({
        status: 409,
        description: 'Configuration already exists for this table'
    })
    async createConfig(@Body() dto: CreatePartitionConfigDto) {
        return await this.partitionConfigService.createConfig(dto);
    }

    /**
         * PUT /partitions/config/:id
         * Update partition configuration
         */
    @Put('config/:id')
    @ApiOperation({
        summary: 'Update partition configuration',
        description: 'Updates an existing partition configuration'
    })
    @ApiParam({
        name: 'id',
        description: 'Configuration ID',
        example: 1
    })
    @ApiResponse({
        status: 200,
        description: 'Configuration updated successfully',
        type: PartitionConfigResponseDto
    })
    @ApiResponse({
        status: 404,
        description: 'Configuration not found'
    })
    async updateConfig(
        @Param('id') id: string,
        @Body() dto: UpdatePartitionConfigDto
    ) {
        return await this.partitionConfigService.updateConfig(+id, dto);
    }

    /**
* DELETE /partitions/config/:id
* Delete partition configuration
*/
    @Delete('config/:id')
    @ApiOperation({
        summary: 'Delete partition configuration',
        description: 'Deletes a partition configuration (does not affect existing partitions)'
    })
    @ApiParam({
        name: 'id',
        description: 'Configuration ID',
        example: 1
    })
    @ApiResponse({
        status: 200,
        description: 'Configuration deleted successfully',
        schema: {
            example: {
                success: true,
                message: 'Configuration deleted successfully'
            }
        }
    })
    @ApiResponse({
        status: 404,
        description: 'Configuration not found'
    })
    async deleteConfig(@Param('id') id: string) {
        await this.partitionConfigService.deleteConfig(+id);
        return {
            success: true,
            message: 'Configuration deleted successfully'
        };
    }
}
