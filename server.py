# load necessary libraries
import json
import os
import numpy as np

# load cherrypy
import cherrypy


class VTSassessment(object):

    @cherrypy.expose
    def index(self):
        return open('index.html')

    def release(self,raw):
        # initialize whether the ball has been thrown
        thrown = False
        # establish release distance threshold (yards)
        dt = 1.25
        # initialize left and right
        maxl,maxr = 0,0
        # initialize return data
        metrics = {'velocity': None,
                   'timetothrow': None,
                   'releaseheight': None,
                   'releaseangle': None,
                   'dropbackdepth': 0,
                   'dropbacktype': "Straight",
                   'sack': False,
                   'sackyardage': 0}
        # loop through ball-tracking data
        for i,j in enumerate(raw['balltrackingdata']):
            if thrown == False:
                # calculate distance between HMD and ball
                dx = (j['simulated_ball']['x']-raw['qbtrackingdata'][i]['hmd_location']['x'])/91.44
                dy = (j['simulated_ball']['y']-raw['qbtrackingdata'][i]['hmd_location']['y'])/91.44
                dz = (j['simulated_ball']['z']-raw['qbtrackingdata'][i]['hmd_location']['z'])/91.44
                dist = (dx**2.0 + dy**2.0 + dz**2.0)**0.5
                # check dropback depth
                if raw['playsituation']['los'] - raw['qbtrackingdata'][i]['hmd_location']['y']/91.44 > metrics['dropbackdepth']:
                    metrics['Dropback Depth'] = raw['playsituation']['los'] - raw['qbtrackingdata'][i]['hmd_location']['y']/91.44
                # Determine drop type - rollout or straight
                if raw['qbtrackingdata'][i]['hmd_location']['x'] > maxl:
                    maxl = raw['qbtrackingdata'][i]['hmd_location']['x']/91.44
                elif -raw['qbtrackingdata'][i]['hmd_location']['x'] > maxr:
                    maxr = -raw['qbtrackingdata'][i]['hmd_location']['x']/91.44
                # if the ball is "far enough" away from the headset, it has been released
                if dist > dt:
                    # release frame
                    rf = i
                    # time to throw
                    metrics['timetothrow'] = raw['qbtrackingdata'][i]['sim_time']-raw['qbtrackingdata'][0]['sim_time']
                    metrics['releaseheight'] = j['simulated_ball']['z']/91.44*36.0     # convert to inches
                    # calculate total distance
                    metrics['releaseangle'] = np.arcsin(dz/dist) * (180.0/np.pi)
                    thrown = True
            else:
                if i >= rf+10 or i == (len(raw['balltrackingdata'])-1):
                    # calculate distance traveled
                    dx = (j['simulated_ball']['x'] - raw['balltrackingdata'][rf]['simulated_ball']['x'])/91.44
                    dy = (j['simulated_ball']['y'] - raw['balltrackingdata'][rf]['simulated_ball']['y'])/91.44
                    dz = (j['simulated_ball']['z'] - raw['balltrackingdata'][rf]['simulated_ball']['z'])/91.44
                    # calculate time elapsed
                    dt = j['sim_time'] - raw['balltrackingdata'][rf]['sim_time']
                    # calculate speed - in mph
                    metrics['velocity'] = ((dx**2.0+dy**2.0+dz**2.0)**0.5)/dt * (3600.0/1760.0)
                    break
        # determine dropback type
        if maxl < -3.5:
            metrics['dropbacktype'] = 'Rollout Left'
        elif maxr > 3.5:
            metrics['dropbacktype'] = 'Rollout Right'
        # if the ball was not thrown, it was a sack
        if thrown == False:
            metrics['timetothrow'] = raw['qbtrackingdata'][len(raw['qbtrackingdata'])-1]['sim_time']-raw['qbtrackingdata'][0]['sim_time']
            # sack statistics
            metrics['sack'] = True
            metrics['sackyardage'] = round(raw['qbtrackingdata'][len(raw['qbtrackingdata'])-1]['hmd_location']['y']/91.44-raw['playsituation']['los'])
        # return value
        return metrics

    def receivercalcs(self, raw):
        # establish release distance threshold (yards)
        dt = 1.25
        # initialize release frame
        rf = None
        # loop through ball-tracking data
        for i,j in enumerate(raw['balltrackingdata']):
                # calculate distance between HMD and ball
                dx = (j['simulated_ball']['x']-raw['qbtrackingdata'][i]['hmd_location']['x'])/91.44
                dy = (j['simulated_ball']['y']-raw['qbtrackingdata'][i]['hmd_location']['y'])/91.44
                dz = (j['simulated_ball']['z']-raw['qbtrackingdata'][i]['hmd_location']['z'])/91.44
                dist = (dx**2.0 + dy**2.0 + dz**2.0)**0.5
                # if the ball is "far enough" away from the headset, it has been released
                if dist > dt:
                    # release frame
                    rf = i
                    break
        # function for calculating orientation
        def orientation(xl,yl,xr,yr):
            # determine angle
            angle = np.arctan2(yr-yl,xr-xl)
            # shift towards player face
            angle += np.pi/2
            # return value of interest
            return angle
        # identify who is running routes
        trackelig = []
        for i,j in enumerate(raw['playerroles']['offense']):
            if j['route'] is not None:
                for m,n in enumerate(raw['playertrackingdata']):
                    if n['playerid'] == j['playerid']:
                        trackelig.append(n)
        # identify which players are on defense
        dnum = []
        for k in raw['playerroles']['defense']:
            dnum.append(k['playerid'])
        # concentrate defensive tracking metrics
        trackd = []
        for i,j in enumerate(raw['playertrackingdata']):
            if j['playerid'] in dnum:
                trackd.append(j['playertracking'])
        # initialize minimum distance for non-thrown away (yards)
        mind = 5
        # set aim point distance in front of shoulders (in yards)
        apd = 0.5
        # initialize the intended receiver
        ir = None
        # initialize data
        stats = {'intendedreceiver': None,
                 'airyards': None,
                 'airdistance': None,
                 'targetedzone': None,
                 'thrownaway': None,
                 'intentionalgrounding': None,
                 'BallPlacementImage': None,
                 'BallTrajectoryImage': None,
                 'separation': [],
                 'defensivebasic': None,
                 'offensivebasic': None}
        # if the ball has been released, re-initialize some entries
        if rf is not None:
            stats['thrownaway'] = False
            stats['BallTrajectoryImage'] = []
            stats['intentionalgrounding'] = False
        # calculate aim point and separation for each time step
        for k in trackelig:
            # each time step
            # initialize separation
            recsep = []
            for i,j in enumerate(k['playertracking']):
                # condense receiver location to single point
                recloc = {}
                recloc['x'] = -(j['leftshoulder']['x']+j['rightshoulder']['x']+j['back']['x'])/3
                recloc['y'] = (j['leftshoulder']['y']+j['rightshoulder']['y']+j['back']['y'])/3
                # for aim point purposes only
                recloc['z'] = (j['leftshoulder']['z']+j['rightshoulder']['z'])/2
                recloc['dir'] = orientation(-j['leftshoulder']['x'],j['leftshoulder']['y'],
                      -j['rightshoulder']['x'],j['rightshoulder']['y'])
                # calculate separation by looping through defenders
                separ = []
                for m in trackd:
                    # defender location
                    dloc = {}
                    dloc['x'] = -(m[i]['leftshoulder']['x']+m[i]['rightshoulder']['x']+m[i]['back']['x'])/3
                    dloc['y'] = (m[i]['leftshoulder']['y']+m[i]['rightshoulder']['y']+m[i]['back']['y'])/3
                    # calculate separation
                    separ.append((((recloc['x']-dloc['x'])**2.0+(recloc['y']-dloc['y'])**2.0)**0.5)/91.44)
                recsep.append(min(separ))
                # after ball is thrown, start tracking aim point, find intended receiver,
                # and create ball placement graphic
                if rf is not None:
                    if i > rf:
                        aimpt = {}
                        aimpt['x'] = (recloc['x'] + apd*np.cos(recloc['dir']))/91.44
                        aimpt['y'] = (recloc['y'] + apd*np.sin(recloc['dir']))/91.44
                        aimpt['z'] = recloc['z']/91.44
                        aimpt['dir'] = recloc['dir']
                        # calculate distance between ball and aim point
                        dx = -raw['balltrackingdata'][i]['simulated_ball']['x']/91.44-aimpt['x']
                        dy = raw['balltrackingdata'][i]['simulated_ball']['y']/91.44-aimpt['y']
                        dz = raw['balltrackingdata'][i]['simulated_ball']['z']/91.44-aimpt['z']
                        dba = (dx**2.0+dy**2.0+dz**2.0)**0.5
                        # identify intended receiver
                        if dba < mind:
                            mind = dba
                            stats['intendedreceiver'] = k['playerid']
                            # coordinates of aim point
                            mark = aimpt
                            # target frame
                            ballmark = {}
                            ballmark['x'] = -raw['balltrackingdata'][i]['simulated_ball']['x']/91.44
                            ballmark['y'] = raw['balltrackingdata'][i]['simulated_ball']['y']/91.44
                            ballmark['z'] = raw['balltrackingdata'][i]['simulated_ball']['z']/91.44
            stats['separation'].append(recsep)
        # if not a sack and not thrown away
        if rf is not None:
            # ball trajectory data
            for i in raw['balltrackingdata']:
                stats['BallTrajectoryImage'].append([i['simulated_ball']['y']/91.44 - raw['playsituation']['los'],
                                       i['simulated_ball']['z']/91.44])
            # if not thrown away, construct accuracy image
            if mind < 5:
                # initialize data to return
                stats['BallPlacementImage'] = {'ball':None,'aimpt':None,'dir':None,
                               'rec':{'xmin':None,'xmax':None,'ymin':None,'ymax':None}}
                # height and width
                rht = mark['z']*(1226.0/995.0)
                rw = mark['z']*(1024.0/995.0)
                # add to min/max
                stats['BallPlacementImage']['rec']['xmin'] = -rw*(261.0/1024.0)
                stats['BallPlacementImage']['rec']['xmax'] = rw*(763.0/1024.0)
                stats['BallPlacementImage']['rec']['ymin'] = 0
                stats['BallPlacementImage']['rec']['ymax'] = rht
                # ball location
                blocx = ((ballmark['x']-mark['x'])**2.0+(ballmark['y']-mark['y'])**2.0)**0.5
                if ballmark['x'] > mark['x']: blocx = -blocx
                stats['BallPlacementImage']['ball'] = {'x':blocx,'y':ballmark['z']}
                # aim point location
                stats['BallPlacementImage']['aimpt'] = {'x':0,'y':mark['z']}
                # determine if the receiver is moving from left to right or right to left
                if abs(mark['dir']) < np.pi/2.0:
                    # running from left to right
                    stats['BallPlacementImage']['dir'] = 'R'
                else:
                    # running from right to left
                    stats['BallPlacementImage']['dir'] = 'L'
            # calculate air yards and air distance
            if stats['intendedreceiver'] is None:
                # air yards
                stats['airyards'] = round(raw['balltrackingdata'][len(raw['balltrackingdata'])-1]['simulated_ball']['y']/91.44)-raw['playsituation']['los']
                # air distance
                dx = raw['balltrackingdata'][len(raw['balltrackingdata'])-1]['simulated_ball']['x']-raw['qbtrackingdata'][rf]['hmd_location']['x']
                dy = raw['balltrackingdata'][len(raw['balltrackingdata'])-1]['simulated_ball']['y']-raw['qbtrackingdata'][rf]['hmd_location']['y']
                stats['airdistance'] = ((dx**2.0+dy**2.0)**0.5)/91.44
            else:
                # calculate air yards
                stats['airyards'] = round(ballmark['y'])-raw['playsituation']['los']
                # calculate air distance
                dx = ballmark['x']-raw['qbtrackingdata'][rf]['hmd_location']['x']/91.44
                dy = ballmark['y']-raw['qbtrackingdata'][rf]['hmd_location']['y']/91.44
                stats['airdistance'] = (dx**2.0+dy**2.0)**0.5
        # check for thrown away and intentional grounding
        if stats['intendedreceiver'] is None:
            if rf is not None:
                stats['thrownaway'] = True
                if abs(raw['qbtrackingdata'][rf]['hmd_direction']['x']-raw['qbtrackingdata'][0]['hmd_direction']['x'])/91.44 < 3.5:
                    stats['intentionalgrounding'] = True
        # zone targeted (if not thrown away)
        if stats['airyards'] is not None and mind < 5:
            if stats['airyards'] > 15:
                stats['targetedzone'] = 'Deep '
            else:
                stats['targetedzone'] = 'Short '
            if ballmark['x'] < -(53+1/3)/6:
                stats['targetedzone'] += 'Left'
            elif ballmark['x'] > (53+1/3)/6:
                stats['targetedzone'] += 'Right'
            else:
                stats['targetedzone'] += 'Middle'
        # calculate offensive basic personnel
        rbc = 0
        tec = 0
        for i in raw['playerroles']['offense']:
            for j in raw['teamroster']['offense']:
                if j['playerid'] == i['playerid']:
                    if j['position']['name'] == 'RB':
                        rbc += 1
                    elif j['position']['name'] == 'TE':
                        tec += 1
        stats['offensivebasic'] = str(rbc)+str(tec)
        # calcluate defensive basic personnel
        dlc = 0
        lbc = 0
        dbc = 0
        for i in raw['playerroles']['defense']:
            for j in raw['teamroster']['defense']:
                if j['playerid'] == i['playerid']:
                    if j['position']['name'] == 'DE':
                        dlc += 1
                    elif j['position']['name'] == 'DT':
                        dlc += 1
                    elif j['position']['name'] == 'LB':
                        lbc += 1
                    elif j['position']['name'] == 'CB':
                        dbc += 1
                    elif j['position']['name'] == 'S':
                        dbc += 1
        stats['defensivebasic'] = str(dlc)+'-'+str(lbc)+'-'+str(dbc)
        # return values of interest
        return stats

    @cherrypy.expose
    @cherrypy.tools.allow(methods=['GET','POST'])
    @cherrypy.tools.json_in()
    @cherrypy.tools.json_out()
    def playcalcs(self):
        # read in json data
        raw = cherrypy.request.json
        # run receivercalcs and release and combine them
        rec = self.receivercalcs(raw)
        rec.update(self.release(raw))
        # return entire dictionary
        return rec


    # Streamlined function to be used to calculate stats necessary to construct
    # summary page without any unnecessary calculation
    def sumcalcs(self, raw):
        # function to calculate receiver orientation
        def orientation(xl,yl,xr,yr):
            # determine angle
            angle = np.arctan2(yr-yl,xr-xl)
            # shift towards player face
            angle += np.pi/2
            # return value of interest
            return angle
        # function to calculate zone targeted
        def passzone(x,y):
            # deep zones
            if y > 15:
                zone = 'Deep '
            else:
                zone = 'Short '
            # determine third
            if x < -(53+1/3)/6:
                zone += 'Left'
            elif x > (53+1/3)/6:
                zone += 'Right'
            else:
                zone += 'Middle'
            # return zone targeted
            return zone
        # initialize results
        results = {}
        # initialize the ball as not thrown
        thrown = False
        # release threshold (yards)
        dt = 1.25
        # aim point distance
        apd = 0.5
        # identify who is running routes
        trackelig = []
        for i,j in enumerate(raw['playerroles']['offense']):
            if j['route'] is not None:
                for m,n in enumerate(raw['playertrackingdata']):
                    if n['playerid'] == j['playerid']:
                        trackelig.append(n)
        # initialize minimum distance
        mind = 5
        # initialize release frame
        rf = None
        # initialize intended receiver
        results['ir'] = None
        # intialize relative ball placement
        rel = {}
        # loop through ball-tracking data
        for i,j in enumerate(raw['balltrackingdata']):
            if thrown == False:
                # calculate distance between HMD and ball
                dx = (j['simulated_ball']['x']-raw['qbtrackingdata'][i]['hmd_location']['x'])/91.44
                dy = (j['simulated_ball']['y']-raw['qbtrackingdata'][i]['hmd_location']['y'])/91.44
                dz = (j['simulated_ball']['z']-raw['qbtrackingdata'][i]['hmd_location']['z'])/91.44
                dist = (dx**2.0 + dy**2.0)**0.5
                # if the ball is "far enough" away from the headset in the X-Y plane, it has been released
                if dist > dt:
                    # release frame
                    rf = i
                    # time to throw
                    results['ttt'] = raw['qbtrackingdata'][i]['sim_time']-raw['qbtrackingdata'][0]['sim_time']
                    results['rh'] = j['simulated_ball']['z']/91.44*36.0     # convert to inches
                    # update thrown status
                    thrown = True
                elif i == len(raw['balltrackingdata'])-1:
                    results['ttt'] = raw['qbtrackingdata'][i]['sim_time']-raw['qbtrackingdata'][0]['sim_time']
            else:
                # after the ball has been thrown, start working towards identifying intended receiver
                for k in trackelig:
                    # condense receiver location to single point
                    orient = orientation(-k['playertracking'][i]['leftshoulder']['x'],k['playertracking'][i]['leftshoulder']['y'],
                      -k['playertracking'][i]['rightshoulder']['x'],k['playertracking'][i]['rightshoulder']['y'])
                    # calculate aimpoint
                    aimpt = {}
                    aimpt['x'] = -(k['playertracking'][i]['leftshoulder']['x']+k['playertracking'][i]['rightshoulder']['x']+k['playertracking'][i]['back']['x'])/3/91.44 + apd*np.cos(orient)
                    aimpt['y'] = (k['playertracking'][i]['leftshoulder']['y']+k['playertracking'][i]['rightshoulder']['y']+k['playertracking'][i]['back']['y'])/3/91.44 + apd*np.sin(orient)
                    aimpt['z'] = (k['playertracking'][i]['leftshoulder']['z']+k['playertracking'][i]['rightshoulder']['z'])/2/91.44
                    # calculate distance between ball and aim point
                    dx = -raw['balltrackingdata'][i]['simulated_ball']['x']/91.44-aimpt['x']
                    dy = raw['balltrackingdata'][i]['simulated_ball']['y']/91.44-aimpt['y']
                    dz = raw['balltrackingdata'][i]['simulated_ball']['z']/91.44-aimpt['z']
                    dba = (dx**2.0+dy**2.0+dz**2.0)**0.5
                    # identify intended receiver
                    if dba < mind:
                        mind = dba
                        results['ir'] = k['playerid']
                        # target frame
                        ballmark = {}
                        ballmark['x'] = -raw['balltrackingdata'][i]['simulated_ball']['x']/91.44
                        ballmark['y'] = raw['balltrackingdata'][i]['simulated_ball']['y']/91.44
                        ballmark['z'] = raw['balltrackingdata'][i]['simulated_ball']['z']/91.44
                        # coordinates of ball relative to aim point
                        rel['x'] = ballmark['x'] - aimpt['x']
                        rel['y'] = ballmark['y'] - aimpt['y']
                        rel['z'] = ballmark['z'] - aimpt['z']
                        if abs(orient) < np.pi/2:
                            rel['dir'] = "R"
                        else:
                            rel['dir'] = "L"
        # calculate ball placement for figure
        results['relbp'] = {}
        if len(rel) > 0:
            rangle = np.arctan2(rel['x'],rel['y'])
            results['relbp']['width'] = rel['x']*np.cos(rangle) + rel['y']*np.sin(rangle)
            results['relbp']['height'] = rel['z']
            results['relbp']['rdir'] = rel['dir']
        # calculate air yards and air distance
        if rf is None:
            # sack (or scramble)
            results['ay'] = None
            results['ad'] = None
            results['zone'] = None
        elif results['ir'] is None:
            # air yards
            results['ay'] = round(raw['balltrackingdata'][len(raw['balltrackingdata'])-1]['simulated_ball']['y']/91.44)-raw['playsituation']['los']
            # air distance
            dx = raw['balltrackingdata'][len(raw['balltrackingdata'])-1]['simulated_ball']['x']/91.44-raw['qbtrackingdata'][rf]['hmd_location']['x']/91.44
            dy = raw['balltrackingdata'][len(raw['balltrackingdata'])-1]['simulated_ball']['y']/91.44-raw['qbtrackingdata'][rf]['hmd_location']['y']/91.44
            results['ad'] = (dx**2.0+dy**2.0)**0.5
        else:
            # calculate air yards
            results['ay'] = round(ballmark['y'])-raw['playsituation']['los']
            # calculate air distance
            dx = ballmark['x']-raw['qbtrackingdata'][rf]['hmd_location']['x']/91.44
            dy = ballmark['y']-raw['qbtrackingdata'][rf]['hmd_location']['y']/91.44
            results['ad'] = (dx**2.0+dy**2.0)**0.5
        # check for intentional grounding
        results['ig'] = False
        if results['ir'] is None:
            if rf is not None:
                if abs(raw['qbtrackingdata'][rf]['hmd_location']['x']-raw['qbtrackingdata'][0]['hmd_location']['x'])/91.44 < 3.5:
                    results['ig'] = True
        # zone targeted (if not thrown away)
        results['zone'] = None
        if results['ay'] is not None and mind < 5:
            results['zone'] = passzone(ballmark['x'],results['ay'])
        # return values of interest
        return results

    @cherrypy.expose
    @cherrypy.tools.allow(methods=['GET','POST'])
    @cherrypy.tools.json_in()
    @cherrypy.tools.json_out()
    def totalstats(self):
        # function to calculate passer rating
        def pr(com,att,yds,td,inter):
            # initialize dictionary
            info = {"rating": None, "ystr":'',"tdintstr":''}
            # calculate passer rating
            if att > 0:
                a = min(2.375,max(0.0,(com/att - 0.3)*5.0))
                b = min(2.375,max(0.0,(yds/att-3.0)*0.25))
                c = min(2.375,max(0.0,(td/att)*20.0))
                d = min(2.375,max(0.0,2.375-(inter/att*25.0)))
                info["rating"] = ((a+b+c+d)*100.0)/6.0
                # construct rating string
                info["ystr"] = str(com)+'/'+str(att)+' '+str(yds)+' yds'
                # separate TD and INT line
                if td > 0:
                    info["tdintstr"] += str(td)+' TD'
                if inter > 0:
                    info["tdintstr"] += ' '+str(inter)+' INT'
            # return values of interest
            return info
        # read in files
        filesinput = cherrypy.request.json
        files = filesinput['files']
        # initialize stats of interest
        totals = {'sacks':0,
                  'intentionalgrounding':0,
                  'thrownaway':0,
                  'completions':0,
                  'attempts':0,
                  'int':0,
                  'passyds':0,
                  'passtd':0,
                  'avgairyards':0,
                  'avgairdistance':0,
                  'avgtimetothrow':0,
                  'completionpct':None,
                  'yardsperattempt':None,
                  'passerrating':None}
        # what unique routes were run
        uroutes = []
        # overall route data
        totals['routedata'] = [['Route','Run','Targets','Completions','Touchdowns','Yards']]
        # initialize ball placement data
        totals['targetimage'] = []
        # initialize zone data
        byzone = {'Deep Left': {'Targets': 0,
                                'Completions': 0,
                                'Touchdowns': 0,
                                'Interceptions': 0,
                                'Yards': 0},
                  'Deep Middle': {'Targets': 0,
                                'Completions': 0,
                                'Touchdowns': 0,
                                'Interceptions': 0,
                                'Yards': 0},
                  'Deep Right': {'Targets': 0,
                                'Completions': 0,
                                'Touchdowns': 0,
                                'Interceptions': 0,
                                'Yards': 0},
                  'Short Left': {'Targets': 0,
                                'Completions': 0,
                                'Touchdowns': 0,
                                'Interceptions': 0,
                                'Yards': 0},
                  'Short Middle': {'Targets': 0,
                                'Completions': 0,
                                'Touchdowns': 0,
                                'Interceptions': 0,
                                'Yards': 0},
                  'Short Right': {'Targets': 0,
                                'Completions': 0,
                                'Touchdowns': 0,
                                'Interceptions': 0,
                                'Yards': 0}}
        # loop through selected files
        for i in range(len(files)):
            # read in and parse file
            raw = json.load(open(files[i]))
            # perform calculations
            mets = self.sumcalcs(raw)
            # relative ball placement
            if len(mets['relbp']) > 0:
                troute = [j['route']['name'] for j in raw['playerroles']['offense'] if j['route'] is not None if j['playerid'] == mets['ir']][0]
                intrec = [j['firstname']+' '+j['lastname'] for j in raw['teamroster']['offense'] if j['playerid'] == mets['ir']][0]
                totals['targetimage'].append({"x":mets['relbp']['width'],"y":mets['relbp']['height'],
                                              "route":troute,"receiver": intrec,"direction":mets['relbp']['rdir'],
                                              "result":raw['playresult']['result']})
            # determine which routes were run
            routes = [j['route']['name'] for j in raw['playerroles']['offense'] if j['route'] is not None]
            for j in routes:
                # accumulate routes run
                for k in totals['routedata']:
                    if j == k[0]:
                        k[1] += 1
                if j not in uroutes:
                    uroutes.append(j)
                    totals['routedata'].append([j,1,0,0,0,0])
            # what was the targeted route?
            if mets['ir'] is not None:
                byzone[mets['zone']]['Targets'] += 1
                troute = [j['route']['name'] for j in raw['playerroles']['offense'] if j['route'] is not None if j['playerid'] == mets['ir']][0]
                for j,k in enumerate(totals['routedata']):
                    if k[0] == troute:
                        update = k
                        update[2] += 1
                        entry = j
                # determine if complete
                if raw['playresult']['result'] == 'Complete':
                    totals['completions'] += 1
                    totals['passyds'] += mets['ay'] + round(raw['playresult']['yac'])
                    update[3] += 1
                    update[5] += mets['ay'] + round(raw['playresult']['yac'])
                    # update zone
                    byzone[mets['zone']]['completions'] += 1
                    byzone[mets['zone']]['Yards'] += mets['ay'] + round(raw['playresult']['yac'])
                    # determine if touchdown
                    if mets['ay'] + raw['playresult']['yac'] > 50-raw['playsituation']['los']:
                        totals['passtd'] += 1
                        byzone[mets['zone']]['Touchdowns'] += 1
                # update routes
                totals['routedata'][entry] = update
            # accumulate time to throw (even on sacks)
            totals['avgtimetothrow'] += mets['ttt']
            # accumulate attempts, air yards, and air distance (on non-sacks)
            if mets['ay'] is not None:
                totals['attempts'] += 1
                totals['avgairyards'] += mets['ay']
                totals['avgairdistance'] += mets['ad']
            else:
                totals['sacks'] += 1
            # accumulate intentionalgrounding
            if mets['ig']:
                totals['intentionalgrounding'] += 1
            # accumulate thrownaway
            if mets['ay'] is not None and mets['ir'] is None:
                totals['thrownaway'] += 1
        # calculate averages
        if totals['attempts'] > 0:
            totals['completionpct'] = totals['completions']/totals['attempts']
            totals['yardsperattempt'] = totals['passyds']/totals['attempts']
            totals['avgairyards'] = totals['avgairyards']/totals['attempts']
            totals['avgairdistance'] = totals['avgairdistance']/totals['attempts']
            totals['avgtimetothrow'] = totals['avgtimetothrow']/len(files)
        # calculate passer rating
        totals['passerrating'] = pr(totals['completions'],totals['attempts'],totals['passyds'],
              totals['passtd'],totals['int'])["rating"]
        # construct cumulative zone-by-zone image
        zonedata = {}
        for i in byzone:
            # calculate passer rating and stats for each zone
            zonedata[i] = pr(byzone[i]['Completions'],byzone[i]['Targets'],byzone[i]['Yards'],byzone[i]['Touchdowns'],byzone[i]['Interceptions'])
        # return zone image data
        totals['zoneimage'] = zonedata
        # return values of interest
        return totals



if __name__ == '__main__':
    # not having to restart the server
    cherrypy.config.update({"engine.autoreload.on": True,
                            "server.socket_host": "0.0.0.0",
                            "server.socket_port": 8081,
                            })

    # finding static directory
    app_conf = {'/static': {"tools.staticdir.on": True,
                            "tools.staticdir.dir":
                                os.path.join(os.getcwd(), "static")}}
    # important
    cherrypy.tree.mount(VTSassessment(), '/', config=app_conf)

    cherrypy.engine.start()
    cherrypy.engine.block()
